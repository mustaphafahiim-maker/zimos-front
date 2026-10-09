import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
// The glass layer over the calm surfaces; off with data-glass="off" on <html>.
import './liquid-glass.css'
import './glass/menu.css'
import './glass/dock.css'
import './glass/spotlight.css'
import './glass/sheet.css'
import './glass/controls.css'
import './glass/notifications.css'
import './glass/states.css'
import './glass/stats.css'
import './glass/motion.css'
import './glass/home.css'
import './glass/home-queue.css'
import './glass/home-journey.css'
import './glass/home-cards.css'
import './glass/home-orders.css'
import './glass/list.css'
import './glass/orders.css'
import './glass/confirm.css'
import './glass/order-page.css'
import './glass/order-create.css'
import './glass/recovery.css'
import './glass/returns-protection.css'
import './glass/reports.css'
import './glass/catalog.css'
import './glass/product.css'
import './glass/offers.css'
import './glass/customers.css'
import './glass/product-media.css'
import './glass/customer-page.css'
import './glass/editor.css'
import './glass/settings.css'
import './glass/website.css'
import './glass/funnel.css'
import './glass/sweep-orders.css'
import './glass/sweep-kinds.css'
import './glass/sweep-inventory.css'
import './glass/sweep-content.css'
import './glass/sweep-marketing.css'
import './glass/sweep-inbox.css'
import './glass/sweep-money.css'
import './glass/funnel-panes.css'
import './glass/sweep-account.css'
import './glass/sweep-catalog.css'
import './glass/sweep-loyalty.css'
import './glass/sweep-offers.css'
import './glass/funnel-canvas.css'
import './glass/funnel-list.css'
import './glass/funnel-sheet.css'
// First, so errors from the rest of the start-up are reported too.
import './lib/errorReporting'
// Page chunks are fetched on hover / touch-start of a menu item (lib/prefetch.ts).
import './routes/prefetch'
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
