# Chrome Extension Basics & How This App Works

## 🎯 What is a Chrome Extension?

A Chrome extension is a small program that customizes your Chrome browsing experience. Think of it as a plugin that can:
- Add new features to Chrome
- Modify web pages
- Interact with browser tabs and windows
- Store data locally
- Add buttons to Chrome's toolbar

## 🏗️ Basic Chrome Extension Architecture

Every Chrome extension has these core components:

```
Chrome Browser
├── Extension Runtime Environment
│   ├── Background Script (Service Worker)
│   ├── Popup UI (Toolbar Button)
│   ├── Content Scripts (Optional - inject into web pages)
│   └── Extension Pages (Full HTML pages)
└── Chrome APIs (tabs, windows, storage, etc.)
```

### The Key Players:

1. **Manifest File** - The extension's configuration
2. **Background Script** - The brain that runs in the background
3. **UI Pages** - What users see and interact with
4. **Chrome APIs** - How the extension talks to the browser

## 📋 The Manifest File (manifest.json)

Think of this as your extension's ID card and permission slip:

```json
{
  "manifest_version": 3,        // Which version of Chrome extension rules to follow
  "name": "Window & Tab Manager",  // What users see
  "version": "1.0.0",           // Your app version
  
  "permissions": [              // What Chrome features you need access to
    "tabs",                     // Read/modify browser tabs
    "storage"                   // Save data locally
  ],
  
  "background": {               // Your always-running script
    "service_worker": "background.js"
  },
  
  "action": {                   // The toolbar button
    "default_popup": "popup.html"
  }
}
```

### Permissions Explained:
- **"tabs"**: Lets us see tab URLs, titles, move tabs, close tabs, etc.
- **"storage"**: Lets us save user preferences (though we're not using it yet)

## 🧠 Background Script (Service Worker)

The background script is like the extension's brain - it's always running and coordinates everything:

```javascript
// This runs 24/7 in the background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // This listens for messages from popup or manager page
  if (message.action === 'getAllWindows') {
    // Use Chrome API to get windows
    chrome.windows.getAll({ populate: true }, (windows) => {
      sendResponse(windows);
    });
  }
});
```

### In Our App:
- **Listens for messages** from our UI pages
- **Validates all requests** for security
- **Talks to Chrome APIs** to manipulate tabs/windows
- **Monitors tab/window changes** and notifies UI

## 🖼️ UI Components

### Popup (popup.html + popup.js)
The small window that appears when you click the extension icon:

```
User clicks extension icon → popup.html loads → popup.js runs
                                    ↓
                          Sends message to background
                                    ↓
                          Background gets tab data
                                    ↓
                          Sends data back to popup
                                    ↓
                          Popup displays the data
```

**Limitations**:
- Fixed width (max ~800px)
- Closes when it loses focus
- Can't do complex interactions

### Extension Pages (manager.html + manager.js)
Full web pages that open in a new tab:

```
User clicks "Open Manager" → New tab opens with manager.html
                                    ↓
                          Manager.js loads and requests data
                                    ↓
                          Same message flow as popup
                                    ↓
                          But now we have full page for complex UI
```

**Advantages**:
- Full-size page
- Stays open
- Can do drag-and-drop
- Complex interactions

## 💬 Message Passing - How Components Talk

Chrome extensions use message passing because each part runs in isolation for security:

```
Popup/Manager Page          Background Script          Chrome APIs
       |                           |                        |
       |  sendMessage({'action'})  |                        |
       |-------------------------->|                        |
       |                           | chrome.tabs.query()    |
       |                           |----------------------->|
       |                           |                        |
       |                           |<-----------------------|
       |  sendResponse(data)       |    Returns tab data    |
       |<--------------------------|                        |
       |                           |                        |
```

### Our Message Flow Example:

1. **User clicks "Close Tab" in UI**
```javascript
// In manager.js
async closeTab(tabId) {
  await this.sendMessage({ 
    action: 'closeTab', 
    data: { tabId: 123 } 
  });
}
```

2. **Background receives and validates**
```javascript
// In background.js
case 'closeTab':
  if (!isValidTabId(data.tabId)) {
    throw new Error('Invalid tab ID');
  }
  await chrome.tabs.remove(data.tabId);
```

3. **Chrome closes the tab**

4. **Tab change listener fires**
```javascript
// In background.js
chrome.tabs.onRemoved.addListener(() => {
  // Notify all UI components to refresh
  chrome.runtime.sendMessage({ action: 'windowsUpdated' });
});
```

5. **UI updates automatically**

## 🔧 Chrome APIs This App Uses

### 1. **chrome.windows API**
Manages browser windows:
```javascript
// Get all windows with their tabs
chrome.windows.getAll({ populate: true }, callback);

// Create new window
chrome.windows.create({ url: 'https://example.com' });

// Focus a window
chrome.windows.update(windowId, { focused: true });

// Close a window
chrome.windows.remove(windowId);
```

### 2. **chrome.tabs API**
Manages individual tabs:
```javascript
// Get tab info
chrome.tabs.get(tabId, callback);

// Create new tab
chrome.tabs.create({ url: 'https://example.com' });

// Move tab to different window
chrome.tabs.move(tabId, { windowId: 123, index: 0 });

// Close tab
chrome.tabs.remove(tabId);

// Update tab (navigate, mute, etc.)
chrome.tabs.update(tabId, { active: true });
```

### 3. **chrome.runtime API**
Extension runtime and messaging:
```javascript
// Send message to background script
chrome.runtime.sendMessage({ action: 'getData' }, response => {
  console.log(response);
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
});

// Get extension URL
chrome.runtime.getURL('manager.html');
```

### 4. **chrome.storage API** (Permission granted but not used yet)
Store user data:
```javascript
// Save data
chrome.storage.local.set({ key: 'value' });

// Get data
chrome.storage.local.get('key', (result) => {
  console.log(result.key);
});
```

## 🎭 How Our App Works - Complete Flow

### 1. **Extension Loads**
```
Chrome starts → Loads manifest.json → Starts background.js service worker
                                            ↓
                                    Sets up message listeners
                                    Sets up tab/window monitors
```

### 2. **User Opens Popup**
```
Click extension icon → popup.html loads → popup.js runs
                                              ↓
                                    Requests all windows/tabs
                                              ↓
                                    Background fetches data
                                              ↓
                                    Popup displays windows/tabs
```

### 3. **User Opens Manager**
```
Click "Open Full Manager" → New tab with manager.html → manager.js runs
                                                              ↓
                                                    Same data flow as popup
                                                              ↓
                                                    But renders in grid layout
                                                    Enables drag-and-drop
```

### 4. **User Drags a Tab**
```
User drags tab → JavaScript drag events fire → Visual feedback
                                                    ↓
                                            User drops on new window
                                                    ↓
                                            Send moveTab message
                                                    ↓
                                            Background validates
                                                    ↓
                                            chrome.tabs.move() API
                                                    ↓
                                            Tab moves in browser
                                                    ↓
                                            Change listener fires
                                                    ↓
                                            UI updates everywhere
```

## 🔒 Security Model

Chrome extensions run with special privileges, so Chrome enforces strict security:

### 1. **Isolated Worlds**
- Background script can't access web page content directly
- Web pages can't access extension code
- Each component runs in isolation

### 2. **Permission Model**
- Must declare all permissions in manifest
- Users see permissions during install
- Can't access APIs without permission

### 3. **Content Security Policy (CSP)**
- No inline JavaScript allowed
- No eval() or similar dangerous functions
- All scripts must be local files

### 4. **Message Validation**
Our app validates everything:
```javascript
// Every message is checked
isValidMessage(message) {
  return message && 
         typeof message === 'object' &&
         typeof message.action === 'string';
}

// Every sender is verified
isValidSender(sender) {
  return sender && sender.id === chrome.runtime.id;
}

// Every input is validated
isValidTabId(tabId) {
  return typeof tabId === 'number' && 
         tabId > 0 && 
         tabId < Number.MAX_SAFE_INTEGER;
}
```

## 🚀 Manifest V3 vs V2

Our extension uses Manifest V3 (the latest standard). Key differences:

### Service Workers (V3) vs Background Pages (V2)
- **V2**: Background page runs constantly
- **V3**: Service worker can sleep and wake up (better performance)

### Security Improvements
- **V2**: Could use remote code
- **V3**: All code must be bundled with extension

### API Changes
- Some APIs work differently
- Better security model
- Required for new extensions

## 📝 Summary - How It All Connects

1. **manifest.json** tells Chrome what our extension can do
2. **background.js** coordinates everything as a service worker
3. **popup.html/js** provides quick access from toolbar
4. **manager.html/js** provides full-featured drag-and-drop interface
5. **Chrome APIs** let us read and manipulate browser state
6. **Message passing** connects all the pieces securely
7. **Event listeners** keep everything in sync

The beauty is that each piece has a specific job:
- **Background**: Security and API access
- **Popup**: Quick actions
- **Manager**: Complex interactions
- **Chrome APIs**: The actual browser manipulation

Together, they create a secure, responsive tab management system!