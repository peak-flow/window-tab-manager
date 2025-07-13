# Development Guide

## 🚀 Quick Start

### 1. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `window-tab-manager` folder
5. The extension icon should appear in your toolbar

### 2. Development Workflow
1. Make changes to your code
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension card
4. Test your changes

### 3. Debugging

#### Background Script (Service Worker)
- In `chrome://extensions/`, click "Inspect views: service worker"
- This opens DevTools for the background script
- Check console for logs and errors
- Use debugger statements

#### Popup
- Right-click the extension icon → "Inspect popup"
- Opens DevTools for the popup
- Note: Popup closes when it loses focus

#### Manager Page
- Open the manager page
- Use regular Chrome DevTools (F12)
- Full debugging capabilities

## 📝 Code Style Guide

### JavaScript
```javascript
// Use async/await for Chrome APIs
async function loadTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs;
  } catch (error) {
    console.error('Failed to load tabs:', error);
    throw error;
  }
}

// Always validate inputs
function isValidTabId(tabId) {
  return typeof tabId === 'number' && 
         tabId > 0 && 
         tabId < Number.MAX_SAFE_INTEGER;
}

// Use descriptive method names
async function moveTabToNewWindow(tabId) {
  // Implementation
}
```

### HTML
```html
<!-- Use semantic HTML -->
<article class="window-card">
  <header class="window-header">
    <h2 class="window-title">Window Title</h2>
  </header>
  <section class="tabs-container">
    <!-- Tab items -->
  </section>
</article>

<!-- Always escape user content -->
<div class="tab-title">${this.escapeHtml(tab.title)}</div>
```

### CSS
```css
/* Component-based organization */
.window-card {
  /* Base styles */
}

.window-card__header {
  /* Header styles */
}

.window-card--focused {
  /* Modifier for focused state */
}

/* Use CSS variables for theming (future) */
:root {
  --primary-color: #1a73e8;
  --danger-color: #ea4335;
}
```

## 🐛 Common Issues & Solutions

### Extension Not Loading
- Check `manifest.json` for syntax errors
- Verify all referenced files exist
- Check Chrome version compatibility

### Popup Closes Immediately
- This is normal when clicking outside
- Use `console.log` or background script for debugging
- Consider using the manager page for complex debugging

### Drag and Drop Not Working
- Ensure `draggable="true"` is set
- Check event listeners are properly attached
- Verify no CSS is blocking pointer events

### Chrome APIs Not Working
- Check permissions in `manifest.json`
- Ensure using correct API methods for Manifest V3
- Some APIs require user interaction

## 🔒 Security Best Practices

### Always Validate Input
```javascript
// Good
if (!this.isValidTabId(tabId)) {
  throw new Error('Invalid tab ID');
}

// Bad
chrome.tabs.remove(tabId); // No validation!
```

### Escape User Content
```javascript
// Good
escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Bad
element.innerHTML = userContent; // XSS vulnerability!
```

### Message Validation
```javascript
// Good
if (!message || typeof message.action !== 'string') {
  return;
}

// Bad
handleMessage(message.action); // No validation!
```

## 📚 Useful Resources

### Chrome Extension APIs
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome APIs Reference](https://developer.chrome.com/docs/extensions/reference/)

### Tools
- [Chrome Extension Source Viewer](https://chrome.google.com/webstore/detail/chrome-extension-source-v/jifpbeccnghkjeaalbbjmodiffmgedin)
- [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)

### Testing
- Multiple window/tab configurations
- Different screen sizes
- Keyboard navigation
- High tab counts (100+ tabs)

## 🎯 Feature Implementation Checklist

When adding a new feature:

- [ ] Plan the feature and its UI/UX
- [ ] Update background.js if new Chrome APIs needed
- [ ] Add message handlers for new operations
- [ ] Implement UI components
- [ ] Add proper error handling
- [ ] Test with edge cases
- [ ] Update documentation
- [ ] Ensure backward compatibility
- [ ] Test security implications

## 💭 Architecture Decisions

### Why Service Worker?
- Manifest V3 requirement
- Better performance
- Enhanced security
- Future-proof

### Why No External Libraries?
- Smaller bundle size
- Fewer dependencies
- Better security
- Full control over code

### Why Real-time Updates?
- Always accurate data
- No sync issues
- Simpler state management
- Better user experience

Happy coding! 🚀