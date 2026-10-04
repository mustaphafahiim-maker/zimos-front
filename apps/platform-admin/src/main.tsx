import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// First, so errors from the rest of the start-up are reported too.
import './lib/errorReporting'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
