# Window & Tab Manager - Project Structure & Development Guide

## 📁 Project Organization

```
window-tab-manager/
├── manifest.json           # Extension configuration
├── background.js          # Service worker (brain of the extension)
├── popup.html            # Popup UI (toolbar interface)
├── popup.js              # Popup logic
├── manager.html          # Full manager page
├── manager.js            # Manager page logic
├── styles/               # All CSS files
│   ├── popup.css        # Popup-specific styles
│   └── manager.css      # Manager page styles
├── assets/              # Static resources
│   └── icons/           # Extension icons
├── README.md            # Project overview
├── ARCHITECTURE.md      # Technical architecture
└── PROJECT_STRUCTURE.md # This file
```

## 📄 File-by-File Breakdown

### Core Configuration

#### `manifest.json`
**Purpose**: Chrome extension configuration file
**Key Responsibilities**:
- Defines extension metadata (name, version, description)
- Declares permissions needed (`tabs`, `storage`)
- Registers the background service worker
- Configures the browser action (popup)
- Sets content security policy

**When to modify**:
- Adding new permissions
- Changing extension metadata
- Adding new content scripts or pages

### Background Script

#### `background.js`
**Purpose**: Central message handler and Chrome API interface
**Class**: `WindowTabManager`
**Key Responsibilities**:
- Validates and routes all messages between UI and Chrome APIs
- Monitors tab/window events for real-time updates
- Implements security checks for all operations
- Provides abstraction layer over Chrome APIs

**Main sections**:
```javascript
// 1. Constructor - Sets up listeners
constructor() {
  this.setupMessageHandlers();
  this.setupTabListeners();
}

// 2. Message validation
isValidMessage(message) { /* validates structure */ }
isValidSender(sender) { /* verifies origin */ }

// 3. Message routing
handleMessage(message, sendResponse) {
  switch (message.action) {
    case 'getAllWindows': /* ... */
    case 'closeTab': /* ... */
    // etc.
  }
}

// 4. Chrome API operations
async getAllWindows() { /* ... */ }
async closeTab() { /* ... */ }
// etc.
```

**When to modify**:
- Adding new operations (new message types)
- Changing validation rules
- Adding new Chrome API integrations

### Popup Interface

#### `popup.html`
**Purpose**: HTML structure for the toolbar popup
**Key Elements**:
- Header with title and "Open Full Manager" button
- Loading/error states
- Windows list container
- Footer with statistics

**Structure**:
```html
<div class="container">
  <header><!-- Title and actions --></header>
  <main>
    <div id="loading"><!-- Loading state --></div>
    <div id="error"><!-- Error state --></div>
    <div id="windowsList"><!-- Dynamic content --></div>
  </main>
  <footer><!-- Statistics --></footer>
</div>
```

#### `popup.js`
**Purpose**: Logic for the popup interface
**Class**: `PopupManager`
**Key Responsibilities**:
- Loads and displays all windows/tabs
- Handles user interactions (focus, close)
- Manages UI states (loading, error, content)
- Communicates with background script

**Main methods**:
```javascript
loadWindows()           // Fetches and displays windows
renderWindows()         // Creates window elements
setupEventListeners()   // Binds click handlers
focusWindow(windowId)   // Focus a window
closeTab(tabId)        // Close a tab
sendMessage(message)    // Communicate with background
```

#### `styles/popup.css`
**Purpose**: Styles for the popup interface
**Key Sections**:
- Container layout (400px width constraint)
- Window and tab item styles
- Button and action styles
- Loading/error states
- Responsive adjustments

### Manager Interface

#### `manager.html`
**Purpose**: Full-page manager interface
**Key Elements**:
- Header with refresh and new window buttons
- Stats bar showing counts
- Windows container (grid layout)
- Drop zone for creating new windows
- Toast notifications
- Confirmation modal

**Structure**:
```html
<div class="app">
  <header><!-- Title and global actions --></header>
  <main>
    <div id="content">
      <div class="stats-bar"><!-- Statistics --></div>
      <div id="windowsContainer"><!-- Window cards --></div>
      <div id="dropZone"><!-- Drop target --></div>
    </div>
  </main>
  <div id="toast"><!-- Notifications --></div>
  <div id="confirmModal"><!-- Confirmations --></div>
</div>
```

#### `manager.js`
**Purpose**: Logic for the full manager page
**Class**: `WindowManager`
**Key Responsibilities**:
- Renders windows in a grid layout
- Implements drag-and-drop functionality
- Shows toast notifications
- Handles confirmation modals
- Manages complex user interactions

**Main methods**:
```javascript
// Core functionality
loadWindows()              // Fetch and display all windows
renderWindows()            // Create window cards
createWindowElement()      // Build individual window
createTabHTML()           // Build tab item HTML

// Drag and drop
setupTabEventListeners()   // Enable dragging
handleDropToNewWindow()    // Create new window from drop
moveTabToWindow()         // Move tab between windows

// User feedback
showToast(message, type)   // Show notifications
showModal()               // Confirmation dialogs
```

#### `styles/manager.css`
**Purpose**: Styles for the manager page
**Key Sections**:
- Grid layout for windows
- Card-based window design
- Drag and drop visual states
- Modal and toast styles
- Responsive breakpoints
- Animations and transitions

### Assets

#### `assets/icons/`
**Purpose**: Extension icons in various sizes
**Files**:
- `icon16.png` - Toolbar icon
- `icon24.png` - Larger toolbar icon
- `icon32.png` - Settings page
- `icon48.png` - Extensions page
- `icon128.png` - Web store listing

## 🔧 Common Development Tasks

### Adding a New Operation

**Example**: Add "Duplicate Tab" functionality

1. **Update background.js** - Add new message handler:
```javascript
case 'duplicateTab':
  await this.duplicateTab(message.data, sendResponse);
  break;

async duplicateTab(data, sendResponse) {
  try {
    if (!this.isValidTabId(data.tabId)) {
      throw new Error('Invalid tab ID');
    }
    
    const tab = await chrome.tabs.get(data.tabId);
    await chrome.tabs.create({
      url: tab.url,
      windowId: tab.windowId,
      index: tab.index + 1
    });
    
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}
```

2. **Update UI** - Add button to tab items:
```javascript
// In createTabHTML() method
<button class="tab-btn duplicate-tab-btn" data-tab-id="${tab.id}" title="Duplicate Tab">
  📋
</button>
```

3. **Add event handler**:
```javascript
// In setupTabEventListeners()
const duplicateBtn = tabItem.querySelector('.duplicate-tab-btn');
duplicateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  this.duplicateTab(tabId);
});

async duplicateTab(tabId) {
  try {
    await this.sendMessage({ 
      action: 'duplicateTab', 
      data: { tabId } 
    });
    this.showToast('Tab duplicated', 'success');
  } catch (error) {
    this.showToast('Failed to duplicate tab', 'error');
  }
}
```

### Adding a New UI Component

**Example**: Add a search bar

1. **Update HTML**:
```html
<!-- In manager.html stats-bar -->
<input type="search" id="searchInput" placeholder="Search tabs..." class="search-input">
```

2. **Add styles**:
```css
/* In manager.css */
.search-input {
  padding: 8px 16px;
  border: 1px solid #dadce0;
  border-radius: 24px;
  font-size: 14px;
  width: 200px;
}
```

3. **Add functionality**:
```javascript
// In manager.js setupEventListeners()
this.elements.searchInput = document.getElementById('searchInput');
this.elements.searchInput.addEventListener('input', (e) => {
  this.filterTabs(e.target.value);
});

filterTabs(query) {
  const lowerQuery = query.toLowerCase();
  const tabItems = document.querySelectorAll('.tab-item');
  
  tabItems.forEach(item => {
    const title = item.querySelector('.tab-title').textContent.toLowerCase();
    const url = item.querySelector('.tab-url').textContent.toLowerCase();
    
    if (title.includes(lowerQuery) || url.includes(lowerQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}
```

### Adding Keyboard Shortcuts

1. **Update manifest.json**:
```json
"commands": {
  "open-manager": {
    "suggested_key": {
      "default": "Ctrl+Shift+M",
      "mac": "Command+Shift+M"
    },
    "description": "Open tab manager"
  }
}
```

2. **Add command listener in background.js**:
```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-manager') {
    chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
  }
});
```

### Adding User Preferences

1. **Create settings object**:
```javascript
// In background.js
const DEFAULT_SETTINGS = {
  theme: 'light',
  confirmBeforeClose: true,
  showTabCounts: true
};

async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
```

2. **Apply settings in UI**:
```javascript
// In manager.js loadWindows()
const settings = await this.getSettings();
if (settings.theme === 'dark') {
  document.body.classList.add('dark-theme');
}
```

## 🎨 Styling Guidelines

### CSS Organization
- Use BEM-like naming: `.window-card`, `.window-card__header`
- Group related styles with comments
- Mobile-first responsive design
- CSS variables for theming (future)

### Color Palette
- Primary: `#1a73e8` (Google Blue)
- Success: `#34a853` (Green)
- Danger: `#ea4335` (Red)
- Background: `#f8f9fa`
- Text: `#333`
- Muted: `#5f6368`

## 🧪 Testing Approach

### Manual Testing Checklist
- [ ] Load extension and check popup
- [ ] Open manager page
- [ ] Create/close windows
- [ ] Drag tabs between windows
- [ ] Test error states (no windows)
- [ ] Test responsive design
- [ ] Verify keyboard navigation

### Chrome Extension Debugging
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Inspect" on background page
4. Use Chrome DevTools for debugging

## 🚀 Deployment Checklist

Before publishing:
1. Update version in `manifest.json`
2. Test all functionality
3. Check console for errors
4. Verify permissions are minimal
5. Create promotional screenshots
6. Write clear description

## 💡 Future Feature Ideas

1. **Tab Search**: Filter tabs by title/URL
2. **Tab Groups**: Support Chrome's tab groups
3. **Keyboard Navigation**: Arrow keys to navigate
4. **Export/Import**: Save window layouts
5. **Tab Suspend**: Free memory from inactive tabs
6. **Recently Closed**: Restore closed tabs/windows
7. **Tab Preview**: Thumbnail on hover
8. **Bulk Actions**: Select multiple tabs
9. **Custom Themes**: User-defined colors
10. **Tab Notes**: Add notes to tabs

This guide should help you understand the codebase structure and how to extend the extension with new features!