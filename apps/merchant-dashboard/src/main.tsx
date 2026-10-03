import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './components/InstallAppPrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable dashboard: the worker only answers page loads while offline (public/sw.js).
registerServiceWorker()
