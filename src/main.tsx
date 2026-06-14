import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
createRoot(root).render(<App />)

// PWA 离线:仅生产环境注册 service worker
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
