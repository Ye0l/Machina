import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error)
    })
  })
}

export default mount(App, { target: document.getElementById('root')! })
