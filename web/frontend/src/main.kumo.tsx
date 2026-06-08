import './react/styles.css'

import { createRoot } from 'react-dom/client'
import { ReactApp } from './react/App'

const rootEl = document.getElementById('app')

if (!rootEl) {
  throw new Error('Missing #app root element')
}

createRoot(rootEl).render(<ReactApp />)
