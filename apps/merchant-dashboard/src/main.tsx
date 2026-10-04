import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './components/InstallAppPrompt'

// Isolated, development-only lab. It mounts no auth/workspace providers and
// makes no backend calls. Vite removes this dynamic import in production.
const DesignSystemApp = import.meta.env.DEV
  ? lazy(() => import('./design-system/DesignSystemApp'))
  : null
const isDesignSystem = DesignSystemApp && window.location.pathname === '/design-system'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesignSystem ? <Suspense fallback={null}><DesignSystemApp /></Suspense> : <App />}
  </StrictMode>,
)

// Installable dashboard: the worker only answers page loads while offline (public/sw.js).
if (!isDesignSystem) registerServiceWorker()
