import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@store-builder/ui/styles.css'
import './index.css'
// The theme: token values first, then the glass material of the shell and of the shared parts.
import './theme/tokens.css'
import './theme/liquid-glass.css'
import './theme/glass/menu.css'
import './theme/glass/controls.css'
import './theme/glass/states.css'
import './theme/glass/stats.css'
import './theme/glass/list.css'
import './theme/glass/sheet.css'
import './theme/glass/motion.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
