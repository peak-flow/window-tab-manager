// Manager page script for Window & Tab Manager

class WindowManager {
  constructor() {
    this.windows = [];
    this.dragData = null;
    this.viewMode = 'grid'; // 'grid' or 'list'
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadWindows();
  }

  initializeElements() {
    this.elements = {
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      content: document.getElementById('content'),
      errorMessage: document.querySelector('.error-message'),
      retryBtn: document.getElementById('retryBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      newWindowBtn: document.getElementById('newWindowBtn'),
      windowsContainer: document.getElementById('windowsContainer'),
      windowCount: document.getElementById('windowCount'),
      tabCount: document.getElementById('tabCount'),
      viewModeBtn: document.getElementById('viewModeBtn'),
      dropZone: document.getElementById('dropZone'),
      toast: document.getElementById('toast'),
      confirmModal: document.getElementById('confirmModal'),
      modalCancel: document.getElementById('modalCancel'),
      modalConfirm: document.getElementById('modalConfirm')
    };
  }

  setupEventListeners() {
    // Header buttons
    this.elements.retryBtn.addEventListener('click', () => this.loadWindows());
    this.elements.refreshBtn.addEventListener('click', () => this.loadWindows());
    this.elements.newWindowBtn.addEventListener('click', () => this.createNewWindow());
    this.elements.viewModeBtn.addEventListener('click', () => this.toggleViewMode());

    // Modal
    this.elements.modalCancel.addEventListener('click', () => this.hideModal());
    
    // Listen for background updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'windowsUpdated') {
        this.loadWindows();
      }
    });

    // Global drag and drop events
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // Drop zone events
    this.elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.add('drag-over');
    });

    this.elements.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove('drag-over');
    });

    this.elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove('drag-over');
      this.handleDropToNewWindow();
    });
  }

  async loadWindows() {
    try {
      this.showLoading();
      
      const response = await this.sendMessage({ action: 'getAllWindows' });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.windows = response.windows || [];
      this.renderWindows();
      this.updateStats();
      this.showContent();
      
    } catch (error) {
      console.error('Failed to load windows:', error);
      this.showError(error.message);
    }
  }

  renderWindows() {
    this.elements.windowsContainer.innerHTML = '';
    
    if (this.windows.length === 0) {
      this.elements.windowsContainer.innerHTML = `
        <div class="empty-state">
          <h2>No windows found</h2>
          <p>Click "New Window" to create one</p>
        </div>
      `;
      return;
    }
    
    this.windows.forEach((window, index) => {
      const windowElement = this.createWindowElement(window, index);
      this.elements.windowsContainer.appendChild(windowElement);
    });
  }

  createWindowElement(window, index) {
    const windowDiv = document.createElement('div');
    windowDiv.className = `window-card ${window.focused ? 'focused' : ''}`;
    windowDiv.dataset.windowId = window.id;
    
    const windowTitle = this.getWindowTitle(window, index);
    const tabsHtml = window.tabs.length > 0 
      ? window.tabs.map(tab => this.createTabHTML(tab)).join('') 
      : '<div class="empty-tabs">No tabs</div>';
    
    windowDiv.innerHTML = `
      <div class="window-header">
        <span class="window-title">${this.escapeHtml(windowTitle)}</span>
        <div class="window-actions">
          <button class="window-btn focus-window-btn" data-window-id="${window.id}" title="Focus Window">
            Focus
          </button>
          <button class="window-btn close-window-btn" data-window-id="${window.id}" title="Close Window">
            Close
          </button>
        </div>
      </div>
      <div class="tabs-container ${window.tabs.length === 0 ? 'empty' : ''}">
        ${tabsHtml}
      </div>
    `;
    
    this.setupWindowEventListeners(windowDiv);
    
    return windowDiv;
  }

  createTabHTML(tab) {
    const faviconUrl = tab.favIconUrl || `chrome://favicon/size/16@2x/${encodeURIComponent(tab.url)}`;
    const tabTitle = tab.title || 'Untitled';
    const displayUrl = this.getDisplayUrl(tab.url);
    
    const indicators = [];
    if (tab.audible) indicators.push('<span class="tab-indicator tab-audible" title="Playing audio">🔊</span>');
    if (tab.mutedInfo?.muted) indicators.push('<span class="tab-indicator tab-muted" title="Muted">🔇</span>');
    if (tab.pinned) indicators.push('<span class="tab-indicator tab-pinned" title="Pinned">📌</span>');
    
    return `
      <div class="tab-item ${tab.active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''}" 
           data-tab-id="${tab.id}" 
           data-window-id="${tab.windowId}"
           draggable="true">
        <img class="tab-favicon" src="${this.escapeHtml(faviconUrl)}" alt="" onerror="this.style.display='none'">
        <div class="tab-info">
          <div class="tab-title">${this.escapeHtml(tabTitle)}</div>
          <div class="tab-url">${this.escapeHtml(displayUrl)}</div>
        </div>
        <div class="tab-indicators">
          ${indicators.join('')}
        </div>
        <div class="tab-actions">
          <button class="tab-btn focus-tab-btn" data-tab-id="${tab.id}" title="Focus Tab">
            👁
          </button>
          <button class="tab-btn close-tab-btn" data-tab-id="${tab.id}" title="Close Tab">
            ✕
          </button>
        </div>
      </div>
    `;
  }

  setupWindowEventListeners(windowElement) {
    const windowId = parseInt(windowElement.dataset.windowId);
    
    // Window actions
    const focusBtn = windowElement.querySelector('.focus-window-btn');
    const closeBtn = windowElement.querySelector('.close-window-btn');
    
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.focusWindow(windowId);
    });
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmCloseWindow(windowId);
    });
    
    // Tab actions and drag/drop
    const tabItems = windowElement.querySelectorAll('.tab-item');
    const tabsContainer = windowElement.querySelector('.tabs-container');
    
    tabItems.forEach(tabItem => {
      this.setupTabEventListeners(tabItem);
    });
    
    // Window drop zone
    tabsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.dragData && this.dragData.windowId !== windowId) {
        windowElement.classList.add('drag-over');
      }
    });
    
    tabsContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      windowElement.classList.remove('drag-over');
    });
    
    tabsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      windowElement.classList.remove('drag-over');
      if (this.dragData && this.dragData.windowId !== windowId) {
        this.moveTabToWindow(this.dragData.tabId, windowId);
      }
    });
  }

  setupTabEventListeners(tabItem) {
    const tabId = parseInt(tabItem.dataset.tabId);
    const windowId = parseInt(tabItem.dataset.windowId);
    
    // Tab click to focus
    tabItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) return;
      this.focusTab(tabId);
    });
    
    // Tab buttons
    const focusBtn = tabItem.querySelector('.focus-tab-btn');
    const closeBtn = tabItem.querySelector('.close-tab-btn');
    
    if (focusBtn) {
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusTab(tabId);
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tabId);
      });
    }
    
    // Drag and drop
    tabItem.addEventListener('dragstart', (e) => {
      this.dragData = { tabId, windowId };
      tabItem.classList.add('dragging');
      this.elements.dropZone.classList.remove('hidden');
      
      // Set drag effect
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Required for Firefox
    });
    
    tabItem.addEventListener('dragend', (e) => {
      tabItem.classList.remove('dragging');
      this.elements.dropZone.classList.add('hidden');
      this.dragData = null;
      
      // Remove drag-over classes from all windows
      document.querySelectorAll('.window-card').forEach(card => {
        card.classList.remove('drag-over');
      });
    });
  }

  async focusWindow(windowId) {
    try {
      await this.sendMessage({ 
        action: 'focusWindow', 
        data: { windowId } 
      });
      this.showToast('Window focused', 'success');
    } catch (error) {
      console.error('Failed to focus window:', error);
      this.showToast('Failed to focus window', 'error');
    }
  }

  async closeWindow(windowId) {
    try {
      await this.sendMessage({ 
        action: 'closeWindow', 
        data: { windowId } 
      });
      this.showToast('Window closed', 'success');
    } catch (error) {
      console.error('Failed to close window:', error);
      this.showToast('Failed to close window', 'error');
    }
  }

  async focusTab(tabId) {
    try {
      await this.sendMessage({ 
        action: 'focusTab', 
        data: { tabId } 
      });
      this.showToast('Tab focused', 'success');
    } catch (error) {
      console.error('Failed to focus tab:', error);
      this.showToast('Failed to focus tab', 'error');
    }
  }

  async closeTab(tabId) {
    try {
      await this.sendMessage({ 
        action: 'closeTab', 
        data: { tabId } 
      });
      this.showToast('Tab closed', 'success');
    } catch (error) {
      console.error('Failed to close tab:', error);
      this.showToast('Failed to close tab', 'error');
    }
  }

  async moveTabToWindow(tabId, targetWindowId) {
    try {
      await this.sendMessage({ 
        action: 'moveTab', 
        data: { tabId, windowId: targetWindowId } 
      });
      this.showToast('Tab moved', 'success');
    } catch (error) {
      console.error('Failed to move tab:', error);
      this.showToast('Failed to move tab', 'error');
    }
  }

  async handleDropToNewWindow() {
    if (!this.dragData) return;
    
    try {
      // Create new window with the dragged tab
      const newWindow = await chrome.windows.create({
        tabId: this.dragData.tabId,
        focused: true
      });
      
      this.showToast('New window created', 'success');
    } catch (error) {
      console.error('Failed to create new window:', error);
      this.showToast('Failed to create new window', 'error');
    }
  }

  async createNewWindow() {
    try {
      await chrome.windows.create({
        url: 'chrome://newtab/',
        focused: true
      });
      this.showToast('New window created', 'success');
    } catch (error) {
      console.error('Failed to create new window:', error);
      this.showToast('Failed to create new window', 'error');
    }
  }

  confirmCloseWindow(windowId) {
    const window = this.windows.find(w => w.id === windowId);
    const tabCount = window ? window.tabs.length : 0;
    
    this.showModal(
      'Close Window',
      `Are you sure you want to close this window? ${tabCount} tab${tabCount !== 1 ? 's' : ''} will be closed.`,
      () => this.closeWindow(windowId)
    );
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
    this.elements.viewModeBtn.innerHTML = `
      <span class="icon">${this.viewMode === 'grid' ? '☰' : '⚏'}</span>
      ${this.viewMode === 'grid' ? 'List View' : 'Grid View'}
    `;
    
    // Update container class
    this.elements.windowsContainer.className = `windows-container ${this.viewMode}-view`;
  }

  getWindowTitle(window, index) {
    const activeTab = window.tabs.find(tab => tab.active);
    if (activeTab && activeTab.title && !activeTab.title.includes('New Tab')) {
      return `Window ${index + 1}: ${activeTab.title}`;
    }
    return `Window ${index + 1} (${window.tabs.length} tab${window.tabs.length !== 1 ? 's' : ''})`;
  }

  getDisplayUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || url;
    } catch {
      return url;
    }
  }

  updateStats() {
    const totalTabs = this.windows.reduce((sum, window) => sum + window.tabs.length, 0);
    this.elements.windowCount.textContent = `${this.windows.length} window${this.windows.length !== 1 ? 's' : ''}`;
    this.elements.tabCount.textContent = `${totalTabs} tab${totalTabs !== 1 ? 's' : ''}`;
  }

  showLoading() {
    this.elements.loading.classList.remove('hidden');
    this.elements.error.classList.add('hidden');
    this.elements.content.classList.add('hidden');
  }

  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.loading.classList.add('hidden');
    this.elements.error.classList.remove('hidden');
    this.elements.content.classList.add('hidden');
  }

  showContent() {
    this.elements.loading.classList.add('hidden');
    this.elements.error.classList.add('hidden');
    this.elements.content.classList.remove('hidden');
  }

  showToast(message, type = 'success') {
    const iconMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };
    
    this.elements.toast.className = `toast ${type}`;
    this.elements.toast.querySelector('.toast-icon').textContent = iconMap[type] || iconMap.info;
    this.elements.toast.querySelector('.toast-message').textContent = message;
    this.elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
      this.elements.toast.classList.add('hidden');
    }, 3000);
  }

  showModal(title, message, onConfirm) {
    this.elements.confirmModal.querySelector('.modal-title').textContent = title;
    this.elements.confirmModal.querySelector('.modal-message').textContent = message;
    
    // Remove any existing confirm listeners
    const newConfirmBtn = this.elements.modalConfirm.cloneNode(true);
    this.elements.modalConfirm.parentNode.replaceChild(newConfirmBtn, this.elements.modalConfirm);
    this.elements.modalConfirm = newConfirmBtn;
    
    this.elements.modalConfirm.addEventListener('click', () => {
      this.hideModal();
      onConfirm();
    });
    
    this.elements.confirmModal.classList.remove('hidden');
  }

  hideModal() {
    this.elements.confirmModal.classList.add('hidden');
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WindowManager();
});