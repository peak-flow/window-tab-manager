# Window & Tab Manager

A secure Chrome extension for managing browser windows and tabs with drag-and-drop functionality.

## Features
- View all windows and tabs in a unified interface
- Drag and drop tabs between windows
- Close windows and individual tabs
- Real-time updates of browser state

## Security Features
- Manifest V3 compliance
- Input validation and sanitization
- Minimal permissions
- No external API dependencies
- Secure message passing

## Development Status
🚧 **In Development** - Rebuilding from scratch with security best practices

## Previous Extension Issues
The original extension had several critical security vulnerabilities that required a complete rewrite:
1. Insufficient message validation
2. Unsafe data storage
3. Unnecessary external API integrations
4. Cross-origin communication vulnerabilities

This rebuild addresses all security concerns while maintaining core functionality.