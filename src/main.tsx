import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
} else if ('serviceWorker' in navigator) {
  // A previously installed production worker can otherwise serve stale Vite
  // modules on localhost and make active development changes appear missing.
  void navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations
      .filter(registration => registration.active?.scriptURL.endsWith('/sw.js'))
      .forEach(registration => void registration.unregister());
  });
}
