import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AccessibilityTaskbar from './Context/AccessibilityTaskbar.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <AccessibilityTaskbar />
    </BrowserRouter>
  </StrictMode>
)
