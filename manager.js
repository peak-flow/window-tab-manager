// Manager page script for Window & Tab Manager

class WindowManager {
    constructor() {
        this.windows = [];
        this.dragData = null;
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.compactMode = false;
        this.groupByDomain = false; // Group tabs by domain
        this.selectedTabs = new Set(); // Track selected tab IDs
        
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
      compactModeBtn: document.getElementById('compactModeBtn'),
      sendToNewWindowBtn: document.getElementById('sendToNewWindowBtn'),
      searchBar: document.getElementById('search-bar'),
      groupByDomainBtn: document.getElementById('groupByDomainBtn'),
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
    this.elements.compactModeBtn.addEventListener('click', () => this.toggleCompactMode());
    this.elements.groupByDomainBtn.addEventListener('click', () => this.toggleGroupByDomain());
    this.elements.sendToNewWindowBtn.addEventListener('click', () => this.sendSelectedToNewWindow());
    
    // Search bar
    if (this.elements.searchBar) {
      this.elements.searchBar.addEventListener('input', this.filterTabs.bind(this));
    }

    // Modal
    this.elements.modalCancel.addEventListener('click', () => this.hideModal());
    
    // Listen for background updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'windowsUpdated') {
        this.loadWindows(true); // Preserve scroll position
      } else if (message.action === 'windowsUpdatedImmediate') {
        // Handle immediate updates without full refresh
        this.handleImmediateUpdate(message.eventType, message.data);
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

  async loadWindows(preserveScrollPosition = false) {
    try {
      // Save scroll position if requested
      let scrollPosition = 0;
      if (preserveScrollPosition) {
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      } else {
        this.showLoading();
      }
      
      const response = await this.sendMessage({ action: 'getAllWindows' });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.windows = response.windows || [];
      this.renderWindows();
      this.updateStats();
      this.showContent();
      
      // Restore scroll position if requested
      if (preserveScrollPosition && scrollPosition > 0) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition);
        });
      }
      
    } catch (error) {
      console.error('Failed to load windows:', error);
      this.showError(error.message);
    }
  }

  // Method to handle search input and filter tabs
    filterTabs() {
        const searchTerm = document.getElementById('search-bar').value.toLowerCase();
        
        // Filter through all windows and tabs
        const filteredWindows = this.windows.map(window => {
          const filteredTabs = window.tabs.filter(tab => tab.url.toLowerCase().includes(searchTerm));
          return { ...window, tabs: filteredTabs };
        }).filter(window => window.tabs.length > 0);

        // Re-render the window list with filtered results
        this.renderWindows(filteredWindows);
    }
    
    renderWindows(windows = this.windows) {
        this.elements.windowsContainer.innerHTML = '';
        
        if (windows.length === 0) {
            this.elements.windowsContainer.innerHTML = `
                <div class="empty-state">
                    <h2>No windows found</h2>
                </div>
            `;
            return;
        }
    
        windows.forEach((window, index) => {
            const windowElement = this.createWindowElement(window, index);
            this.elements.windowsContainer.appendChild(windowElement);
        });
    }

  createWindowElement(window, index) {
    const windowDiv = document.createElement('div');
    windowDiv.className = `window-card ${window.focused ? 'focused' : ''}`;
    windowDiv.dataset.windowId = window.id;
    
    const windowTitle = this.getWindowTitle(window, index);
    
    let tabsContent;
    if (window.tabs.length === 0) {
      tabsContent = '<div class="empty-tabs">No tabs</div>';
    } else if (this.groupByDomain) {
      // Group tabs by domain
      tabsContent = this.createGroupedTabsHTML(window.tabs);
    } else {
      // Normal tab display
      tabsContent = window.tabs.map(tab => this.createTabHTML(tab)).join('');
    }
    
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
      <div class="tabs-container ${window.tabs.length === 0 ? 'empty' : ''} ${this.groupByDomain ? 'grouped' : ''}">
        ${tabsContent}
      </div>
    `;
    
    this.setupWindowEventListeners(windowDiv);
    
    return windowDiv;
  }

  createGroupedTabsHTML(tabs) {
    // Group tabs by domain
    const groups = {};
    
    tabs.forEach(tab => {
      const domain = this.getDomainFromUrl(tab.url);
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab);
    });
    
    // Sort domains alphabetically
    const sortedDomains = Object.keys(groups).sort();
    
    // Create HTML for grouped tabs
    let html = '';
    sortedDomains.forEach(domain => {
      const domainTabs = groups[domain];
      const tabIds = domainTabs.map(tab => tab.id).join(',');
      html += `
        <div class="domain-group">
          <div class="domain-header">
            <div class="domain-info">
              <span class="domain-name">${this.escapeHtml(domain)}</span>
              <span class="domain-count">(${domainTabs.length})</span>
            </div>
            <button class="domain-action-btn move-domain-btn" 
                    data-domain="${this.escapeHtml(domain)}" 
                    data-tab-ids="${tabIds}"
                    title="Move all ${this.escapeHtml(domain)} tabs to new window">
              <span class="icon">🪟</span>
            </button>
          </div>
          <div class="domain-tabs">
            ${domainTabs.map(tab => this.createTabHTML(tab)).join('')}
          </div>
        </div>
      `;
    });
    
    return html;
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || 'Unknown';
    } catch {
      // Handle special Chrome URLs
      if (url.startsWith('chrome://')) {
        return 'Chrome Pages';
      } else if (url.startsWith('chrome-extension://')) {
        return 'Extensions';
      } else if (url === 'about:blank' || !url) {
        return 'Blank Pages';
      }
      return 'Unknown';
    }
  }

  createTabHTML(tab) {
    // Handle favicon URL with proper fallbacks
    let faviconUrl = tab.favIconUrl;
    
    // Determine the best favicon approach based on URL type
    if (tab.url.startsWith('chrome-extension://')) {
      // For extension pages, use a generic extension icon
      faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M20.5,11H19V7c0-1.1-0.9-2-2-2h-4V3.5C13,2.12,11.88,1,10.5,1S8,2.12,8,3.5V5H4C2.9,5,2,5.9,2,7v3.8h1.5c1.4,0,2.5,1.1,2.5,2.5S4.9,16,3.5,16H2V20c0,1.1,0.9,2,2,2h3.8v-1.5c0-1.4,1.1-2.5,2.5-2.5s2.5,1.1,2.5,2.5V22H17c1.1,0,2-0.9,2-2v-4h1.5c1.38,0,2.5-1.12,2.5-2.5S21.88,11,20.5,11z"/></svg>';
    } else if (tab.url.startsWith('file://')) {
      // For local files, use a file icon
      faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>';
    } else if (tab.url.startsWith('chrome://')) {
      // For chrome pages, use a chrome icon
      faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12,20L15.46,14H8.54L12,20M12,4A8,8 0 0,1 20,12C20,12.34 19.97,12.67 19.92,13H16.64C17.21,12.17 17.21,11.83 16.64,11H19.92C19.97,11.33 20,11.66 20,12A8,8 0 0,1 12,20V4M4,12A8,8 0 0,1 12,4V20A8,8 0 0,1 4,12Z"/></svg>';
    } else if (!faviconUrl && tab.url.startsWith('http')) {
      // For web URLs without favicons, try chrome://favicon
      faviconUrl = `chrome://favicon/size/16@2x/${encodeURIComponent(tab.url)}`;
    } else if (!faviconUrl) {
      // Generic fallback for any other case
      faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8Z"/></svg>';
    }
    
    const tabTitle = tab.title || 'Untitled';
    const displayUrl = this.getDisplayUrl(tab.url);
    
    const indicators = [];
    if (tab.audible) indicators.push('<span class="tab-indicator tab-audible" title="Playing audio">🔊</span>');
    if (tab.mutedInfo?.muted) indicators.push('<span class="tab-indicator tab-muted" title="Muted">🔇</span>');
    if (tab.pinned) indicators.push('<span class="tab-indicator tab-pinned" title="Pinned">📌</span>');
    
    return `
      <div class="tab-item ${tab.active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''}${this.selectedTabs.has(tab.id) ? ' selected' : ''}" 
           data-tab-id="${tab.id}" 
           data-window-id="${tab.windowId}"
           draggable="true">
        <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}" ${this.selectedTabs.has(tab.id) ? 'checked' : ''}>
        <img class="tab-favicon" src="${this.escapeHtml(faviconUrl)}" alt="">
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
      
      // Handle favicon errors with better fallback
      const favicon = tabItem.querySelector('.tab-favicon');
      if (favicon) {
        favicon.addEventListener('error', () => {
          // Try a different approach based on the original URL
          const tabId = parseInt(tabItem.dataset.tabId);
          const tab = this.findTabById(tabId);
          
          if (tab && favicon.src.includes('chrome://favicon')) {
            // If chrome://favicon failed, try a generic web icon
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8Z"/></svg>';
          } else {
            // Show a blank placeholder instead of hiding the favicon completely
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="transparent" stroke="%23ccc" stroke-width="1" rx="2"/></svg>';
            favicon.style.display = 'inline';
          }
        });
      }
    });
    
    // Tab checkbox event listeners
    const tabCheckboxes = windowElement.querySelectorAll('.tab-checkbox');
    tabCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.handleTabSelection(parseInt(checkbox.dataset.tabId), checkbox.checked);
      });
    });
    
    // Domain action button listeners
    const domainActionBtns = windowElement.querySelectorAll('.move-domain-btn');
    domainActionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        const tabIds = btn.dataset.tabIds.split(',').map(id => parseInt(id));
        this.moveDomainToNewWindow(domain, tabIds);
      });
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
      if (e.target.classList.contains('tab-btn') || e.target.classList.contains('tab-checkbox')) return;
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
    
    this.updateContainerClass();
  }

  toggleCompactMode() {
    this.compactMode = !this.compactMode;
    this.elements.compactModeBtn.innerHTML = `
      <span class="icon">🗜️</span>
      ${this.compactMode ? 'Normal' : 'Compact'}
    `;
    
    this.updateContainerClass();
  }

  toggleGroupByDomain() {
    this.groupByDomain = !this.groupByDomain;
    this.elements.groupByDomainBtn.innerHTML = `
      <span class="icon">🌐</span>
      ${this.groupByDomain ? 'Ungroup' : 'Group by Domain'}
    `;
    
    this.elements.groupByDomainBtn.classList.toggle('active');
    
    // Reload windows to apply grouping
    this.loadWindows();
  }

  updateContainerClass() {
    const classes = ['windows-container'];
    classes.push(`${this.viewMode}-view`);
    if (this.compactMode) {
      classes.push('compact-view');
    }
    this.elements.windowsContainer.className = classes.join(' ');
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

  handleImmediateUpdate(eventType, data) {
    // Handle specific immediate updates without full refresh
    switch (eventType) {
      case 'tabMoved':
        // For now, just do a full refresh but this could be optimized
        // to move specific DOM elements
        this.loadWindows(true); // Preserve scroll position
        break;
      case 'tabAttached':
      case 'tabDetached':
        // Tab moved between windows - full refresh needed
        this.loadWindows(true); // Preserve scroll position
        break;
    }
  }

  handleTabSelection(tabId, isSelected) {
    if (isSelected) {
      this.selectedTabs.add(tabId);
    } else {
      this.selectedTabs.delete(tabId);
    }
    
    // Update the button visibility based on selection count
    if (this.elements.sendToNewWindowBtn) {
      this.elements.sendToNewWindowBtn.style.display = this.selectedTabs.size > 0 ? 'inline-block' : 'none';
    }
  }

  async sendSelectedToNewWindow() {
    if (this.selectedTabs.size === 0) {
      this.showToast('No tabs selected', 'error');
      return;
    }
    
    try {
      const tabIds = Array.from(this.selectedTabs);
      
      // Create new window with the first selected tab
      const firstTabId = tabIds[0];
      const newWindow = await chrome.windows.create({
        tabId: firstTabId,
        focused: true
      });
      
      // Move remaining tabs to the new window
      if (tabIds.length > 1) {
        for (let i = 1; i < tabIds.length; i++) {
          await chrome.tabs.move(tabIds[i], {
            windowId: newWindow.id,
            index: -1
          });
        }
      }
      
      // Clear selection
      this.selectedTabs.clear();
      this.showToast(`Moved ${tabIds.length} tab${tabIds.length !== 1 ? 's' : ''} to new window`, 'success');
      
    } catch (error) {
      console.error('Failed to move tabs to new window:', error);
      this.showToast('Failed to move tabs to new window', 'error');
    }
  }

  async moveDomainToNewWindow(domain, tabIds) {
    if (tabIds.length === 0) return;
    
    try {
      // Create new window with the first tab
      const firstTabId = tabIds[0];
      const newWindow = await chrome.windows.create({
        tabId: firstTabId,
        focused: true
      });
      
      // Move remaining tabs to the new window
      if (tabIds.length > 1) {
        for (let i = 1; i < tabIds.length; i++) {
          await chrome.tabs.move(tabIds[i], {
            windowId: newWindow.id,
            index: -1
          });
        }
      }
      
      this.showToast(`Moved ${tabIds.length} ${domain} tab${tabIds.length !== 1 ? 's' : ''} to new window`, 'success');
      
    } catch (error) {
      console.error('Failed to move domain tabs to new window:', error);
      this.showToast(`Failed to move ${domain} tabs`, 'error');
    }
  }

  findTabById(tabId) {
    for (const window of this.windows) {
      const tab = window.tabs.find(tab => tab.id === tabId);
      if (tab) return tab;
    }
    return null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const windowManager = new WindowManager();
});