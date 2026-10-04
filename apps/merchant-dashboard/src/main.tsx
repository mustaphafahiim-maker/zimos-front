import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// First, so errors from the rest of the start-up are reported too.
import './lib/errorReporting'
import App from './App.tsx'
import { registerServiceWorker } from './components/InstallAppPrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable dashboard: the worker only answers page loads while offline (public/sw.js).
registerServiceWorker()
