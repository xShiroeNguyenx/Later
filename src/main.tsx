import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('app')!).render(<App />)

// The static shell in index.html and the real Home screen are the same pixels,
// so this swap is invisible. One frame of overlap costs nothing and means the
// screen is never briefly empty.
requestAnimationFrame(() => document.getElementById('boot')?.remove())

// Offline support is a nicety compared to opening fast, so it waits until the
// main thread has nothing better to do.
const later = (fn: () => void) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500)

later(() => {
  import('virtual:pwa-register')
    .then((m) => m.registerSW({ immediate: false }))
    .catch(() => {
      /* no service worker in this environment; the app works regardless */
    })
})
