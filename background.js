// Background service worker for Window & Tab Manager
// Handles tab/window operations and message passing

class WindowTabManager {
  constructor() {
    this.updateTimer = null;
    this.setupMessageHandlers();
    this.setupTabListeners();
    this.setupCommandHandlers();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Validate message structure
      if (!this.isValidMessage(message)) {
        console.warn('Invalid message received:', message);
        sendResponse({ error: 'Invalid message format' });
        return false;
      }

      // Verify sender is from our extension
      if (!this.isValidSender(sender)) {
        console.warn('Unauthorized sender:', sender);
        sendResponse({ error: 'Unauthorized sender' });
        return false;
      }

      // Handle the message
      this.handleMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  setupTabListeners() {
    // Listen for tab/window changes to update UI
    chrome.tabs.onCreated.addListener(() => this.notifyUIUpdate());
    chrome.tabs.onRemoved.addListener(() => this.notifyUIUpdate());
    
    // Tab moves should be instant - no debouncing
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
      this.notifyUIUpdateImmediate('tabMoved', { tabId, moveInfo });
    });
    
    // Tab attach/detach (moving between windows) should also be instant
    chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
      this.notifyUIUpdateImmediate('tabAttached', { tabId, attachInfo });
    });
    
    chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
      this.notifyUIUpdateImmediate('tabDetached', { tabId, detachInfo });
    });
    
    // Only update on significant tab changes, not every update
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only notify if URL or title changed significantly
      if (changeInfo.url || changeInfo.title) {
        this.notifyUIUpdate();
      }
    });
    
    chrome.windows.onCreated.addListener(() => this.notifyUIUpdate());
    chrome.windows.onRemoved.addListener(() => this.notifyUIUpdate());
  }

  setupCommandHandlers() {
    // Handle keyboard shortcuts
    chrome.commands.onCommand.addListener((command) => {
      switch (command) {
        case 'open-manager':
          this.openManagerPage();
          break;
      }
    });
  }

  isValidMessage(message) {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.action === 'string' &&
      message.action.length > 0 &&
      message.action.length < 100 // Reasonable limit
    );
  }

  isValidSender(sender) {
    // Only allow messages from our extension
    return sender && sender.id === chrome.runtime.id;
  }

  async handleMessage(message, sendResponse) {
    try {
      switch (message.action) {
        case 'getAllWindows':
          await this.getAllWindows(sendResponse);
          break;
        
        case 'closeTab':
          await this.closeTab(message.data, sendResponse);
          break;
        
        case 'closeWindow':
          await this.closeWindow(message.data, sendResponse);
          break;
        
        case 'moveTab':
          await this.moveTab(message.data, sendResponse);
          break;
        
        case 'focusWindow':
          await this.focusWindow(message.data, sendResponse);
          break;
        
        case 'focusTab':
          await this.focusTab(message.data, sendResponse);
          break;
        
        default:
          sendResponse({ error: 'Unknown action: ' + message.action });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async getAllWindows(sendResponse) {
    try {
      const windows = await chrome.windows.getAll({
        populate: true,
        windowTypes: ['normal']
      });
      
      // Clean and format the data
      const cleanWindows = windows.map(window => ({
        id: window.id,
        focused: window.focused,
        type: window.type,
        state: window.state,
        tabs: window.tabs.map(tab => ({
          id: tab.id,
          windowId: tab.windowId,
          index: tab.index,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          active: tab.active,
          pinned: tab.pinned,
          audible: tab.audible,
          mutedInfo: tab.mutedInfo
        }))
      }));
      
      sendResponse({ success: true, windows: cleanWindows });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async closeTab(data, sendResponse) {
    try {
      // Validate tab ID
      if (!this.isValidTabId(data.tabId)) {
        throw new Error('Invalid tab ID');
      }
      
      await chrome.tabs.remove(data.tabId);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async closeWindow(data, sendResponse) {
    try {
      // Validate window ID
      if (!this.isValidWindowId(data.windowId)) {
        throw new Error('Invalid window ID');
      }
      
      await chrome.windows.remove(data.windowId);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async moveTab(data, sendResponse) {
    try {
      // Validate input
      if (!this.isValidTabId(data.tabId) || !this.isValidWindowId(data.windowId)) {
        throw new Error('Invalid tab or window ID');
      }
      
      const index = typeof data.index === 'number' ? data.index : -1;
      
      await chrome.tabs.move(data.tabId, {
        windowId: data.windowId,
        index: index
      });
      
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async focusWindow(data, sendResponse) {
    try {
      if (!this.isValidWindowId(data.windowId)) {
        throw new Error('Invalid window ID');
      }
      
      await chrome.windows.update(data.windowId, { focused: true });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  async focusTab(data, sendResponse) {
    try {
      if (!this.isValidTabId(data.tabId)) {
        throw new Error('Invalid tab ID');
      }
      
      await chrome.tabs.update(data.tabId, { active: true });
      
      // Also focus the window
      const tab = await chrome.tabs.get(data.tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  isValidTabId(tabId) {
    return typeof tabId === 'number' && tabId > 0 && tabId < Number.MAX_SAFE_INTEGER;
  }

  isValidWindowId(windowId) {
    return typeof windowId === 'number' && windowId > 0 && windowId < Number.MAX_SAFE_INTEGER;
  }

  notifyUIUpdate() {
    // Debounce updates to avoid rapid refreshes
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      // Send update notification to any open popup/manager pages
      chrome.runtime.sendMessage({ action: 'windowsUpdated' }).catch(() => {
        // Ignore errors if no listeners (popup closed)
      });
    }, 300); // Wait 300ms before updating
  }

  notifyUIUpdateImmediate(eventType, data) {
    // Send immediate update for critical events like tab moves
    chrome.runtime.sendMessage({ 
      action: 'windowsUpdatedImmediate',
      eventType,
      data 
    }).catch(() => {
      // Ignore errors if no listeners (popup closed)
    });
  }

  async openManagerPage() {
    try {
      // Check if manager page is already open
      const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('manager.html') });
      
      if (tabs.length > 0) {
        // Manager page is already open, focus it
        const tab = tabs[0];
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        // Open new manager page
        await chrome.tabs.create({
          url: chrome.runtime.getURL('manager.html'),
          active: true
        });
      }
    } catch (error) {
      console.error('Failed to open manager page:', error);
    }
  }
}

// Initialize the manager
new WindowTabManager();

console.log('Window & Tab Manager background service worker loaded');