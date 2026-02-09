import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import './index.css'
import App from './App'
import { AuthProvider } from './AuthProvider'
import { initializeAuth, msalConfig } from './authConfig'
import LoginPage from './LoginPage'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

// Initialize authentication configuration
initializeAuth().then(config => {
  let msalInstance: PublicClientApplication | null = null
  
  if (config.mode === 'prod' && msalConfig) {
    msalInstance = new PublicClientApplication(msalConfig)
    msalInstance.initialize().then(() => {
      renderApp(msalInstance)
    })
  } else {
    renderApp(null)
  }
}).catch(error => {
  console.error('Failed to initialize auth:', error)
  rootElement.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize authentication. Please refresh the page.</div>'
})

function renderApp(msalInstance: PublicClientApplication | null) {
  createRoot(rootElement!).render(
    <StrictMode>
      <AuthProvider msalInstance={msalInstance}>
        <App />
      </AuthProvider>
    </StrictMode>,
  )
}

