import { useAuth } from './AuthProvider'
import './LoginPage.css'

export default function LoginPage() {
  const { login, mode } = useAuth()

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>🎯 fuzzy-fishstick</h1>
        <h2>To-Do List</h2>
        <p className="login-description">
          Please sign in to access your to-do list
        </p>
        
        {mode === 'dev' && (
          <div className="dev-mode-badge">
            Development Mode
          </div>
        )}
        
        <button className="login-button" onClick={login}>
          Sign In
        </button>
        
        {mode === 'dev' && (
          <p className="dev-hint">
            Click "Sign In" to select a test user
          </p>
        )}
      </div>
    </div>
  )
}
