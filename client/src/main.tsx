import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('🚀 Starting TekRiders with PouchDB stub...');

// Enhanced error handling
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  
  console.log('✅ Root element found, rendering App...');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('✅ App rendered successfully!');
} catch (error) {
  console.error('❌ Failed to mount app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; background: #fee; color: #c00; font-family: Arial;">
      <h1>❌ App Mount Failed</h1>
      <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
    </div>
  `;
}
