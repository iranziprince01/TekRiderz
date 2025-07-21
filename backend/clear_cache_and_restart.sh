#!/bin/bash

echo "🧹 Clearing all caches and restarting..."

# Stop any running dev servers
pkill -f "npm run dev" || true
pkill -f "vite" || true

# Clear all caches
cd ../client
rm -rf node_modules/.cache
rm -rf .vite
rm -rf dist
rm -rf .next

# Clear browser cache (if possible)
echo "🌐 Please manually clear your browser cache:"
echo "   - Open DevTools (F12)"
echo "   - Right-click refresh button"
echo "   - Select 'Empty Cache and Hard Reload'"
echo "   - Or press Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)"

# Restart dev server
echo "🚀 Restarting development server..."
npm run dev 