// Popup script for Window & Tab Manager

class PopupManager {
  constructor() {
    this.windows = [];
    this.initializeElements();
    this.setupEventListeners();
    this.loadWindows();
  }

  initializeElements() {
    this.elements = {
      loading: document.getElementById('loading'),
      error: document.getElementById('error'),
      errorMessage: document.querySelector('.error-message'),
      retryBtn: document.getElementById('retry'),
      windowsList: document.getElementById('windowsList'),
      windowCount: document.getElementById('windowCount'),
      tabCount: document.getElementById('tabCount'),
      openManagerBtn: document.getElementById('openManager')
    };
  }

  setupEventListeners() {
    this.elements.retryBtn.addEventListener('click', () => this.loadWindows());
    this.elements.openManagerBtn.addEventListener('click', () => this.openFullManager());
    
    // Listen for background updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'windowsUpdated') {
        this.loadWindows();
      }
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
    this.elements.windowsList.innerHTML = '';
    
    if (this.windows.length === 0) {
      this.elements.windowsList.innerHTML = '<p class="no-windows">No windows found</p>';
      return;
    }
    
    this.windows.forEach((window, index) => {
      const windowElement = this.createWindowElement(window, index);
      this.elements.windowsList.appendChild(windowElement);
    });
  }

  createWindowElement(window, index) {
    const windowDiv = document.createElement('div');
    windowDiv.className = `window-item ${window.focused ? 'window-focused' : ''}`;
    
    const windowTitle = this.getWindowTitle(window, index);
    
    windowDiv.innerHTML = `
      <div class="window-header">
        <span class="window-title">${this.escapeHtml(windowTitle)}</span>
        <div class="window-actions">
          <button class="window-btn focus-btn" data-window-id="${window.id}" title="Focus Window">
            Focus
          </button>
          <button class="window-btn close-btn" data-window-id="${window.id}" title="Close Window">
            Close
          </button>
        </div>
      </div>
      <div class="tabs-list">
        ${window.tabs.map(tab => this.createTabHTML(tab)).join('')}
      </div>
    `;
    
    // Add event listeners
    this.setupWindowEventListeners(windowDiv);
    
    return windowDiv;
  }

  createTabHTML(tab) {
    const faviconUrl = tab.favIconUrl || 'chrome://favicon/' + encodeURIComponent(tab.url);
    const tabTitle = tab.title || 'Untitled';
    const displayUrl = this.getDisplayUrl(tab.url);
    
    return `
      <div class="tab-item ${tab.active ? 'tab-active' : ''}" data-tab-id="${tab.id}">
        <img class="tab-favicon" src="${this.escapeHtml(faviconUrl)}" alt="" onerror="this.style.display='none'">
        <div class="tab-info">
          <div class="tab-title">${this.escapeHtml(tabTitle)}</div>
          <div class="tab-url">${this.escapeHtml(displayUrl)}</div>
        </div>
        <div class="tab-actions">
          <button class="tab-btn close-tab-btn" data-tab-id="${tab.id}" title="Close Tab">
            ✕
          </button>
        </div>
      </div>
    `;
  }

  setupWindowEventListeners(windowElement) {
    // Window actions
    const focusBtn = windowElement.querySelector('.focus-btn');
    const closeBtn = windowElement.querySelector('.close-btn');
    
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.focusWindow(parseInt(focusBtn.dataset.windowId));
    });
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeWindow(parseInt(closeBtn.dataset.windowId));
    });
    
    // Tab actions
    const tabItems = windowElement.querySelectorAll('.tab-item');
    const closeTabBtns = windowElement.querySelectorAll('.close-tab-btn');
    
    tabItems.forEach(tabItem => {
      tabItem.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-tab-btn')) return;
        this.focusTab(parseInt(tabItem.dataset.tabId));
      });
    });
    
    closeTabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(parseInt(btn.dataset.tabId));
      });
    });
  }

  async focusWindow(windowId) {
    try {
      await this.sendMessage({ 
        action: 'focusWindow', 
        data: { windowId } 
      });
      window.close(); // Close popup after action
    } catch (error) {
      console.error('Failed to focus window:', error);
    }
  }

  async closeWindow(windowId) {
    try {
      await this.sendMessage({ 
        action: 'closeWindow', 
        data: { windowId } 
      });
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }

  async focusTab(tabId) {
    try {
      await this.sendMessage({ 
        action: 'focusTab', 
        data: { tabId } 
      });
      window.close(); // Close popup after action
    } catch (error) {
      console.error('Failed to focus tab:', error);
    }
  }

  async closeTab(tabId) {
    try {
      await this.sendMessage({ 
        action: 'closeTab', 
        data: { tabId } 
      });
    } catch (error) {
      console.error('Failed to close tab:', error);
    }
  }

  openFullManager() {
    // TODO: Implement full manager page
    chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
    window.close();
  }

  getWindowTitle(window, index) {
    // Try to get a meaningful window title
    const activeTab = window.tabs.find(tab => tab.active);
    if (activeTab && activeTab.title) {
      return `Window ${index + 1}: ${activeTab.title}`;
    }
    return `Window ${index + 1} (${window.tabs.length} tabs)`;
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
    this.elements.windowsList.classList.add('hidden');
  }

  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.loading.classList.add('hidden');
    this.elements.error.classList.remove('hidden');
    this.elements.windowsList.classList.add('hidden');
  }

  showContent() {
    this.elements.loading.classList.add('hidden');
    this.elements.error.classList.add('hidden');
    this.elements.windowsList.classList.remove('hidden');
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

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});