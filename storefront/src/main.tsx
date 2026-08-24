import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { captureRefFromUrl } from './lib/ref'
import './index.css'

// Capture a shared referral link (?ref=CODE) before the app renders.
captureRefFromUrl()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Honor the OS "reduce motion" setting across all animations (accessibility). */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <CartProvider>
            <App />
            <Toaster position="top-center" toastOptions={{
              style: { background: '#4a131e', color: '#fbf5ea', fontSize: '14px' }
            }} />
          </CartProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>
)
