import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react'
import { authConfig, msalConfig, type UserInfo, type MockUser } from './authConfig'

interface AuthContextType {
  isAuthenticated: boolean
  user: UserInfo | null
  login: () => void
  logout: () => void
  getAccessToken: () => Promise<string | null>
  mode: 'dev' | 'prod'
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Production Auth Provider using MSAL
function ProdAuthContent({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0]
      setUser({
        email: account.username,
        name: account.name,
      })
    }
  }, [isAuthenticated, accounts])

  const login = () => {
    instance.loginRedirect({
      scopes: ['openid', 'profile', 'email'],
    })
  }

  const logout = () => {
    instance.logoutRedirect()
  }

  const getAccessToken = async (): Promise<string | null> => {
    if (accounts.length === 0) return null

    try {
      const response = await instance.acquireTokenSilent({
        scopes: ['openid', 'profile', 'email'],
        account: accounts[0],
      })
      return response.idToken
    } catch (error) {
      console.error('Failed to acquire token:', error)
      // Try interactive login
      try {
        const response = await instance.acquireTokenPopup({
          scopes: ['openid', 'profile', 'email'],
        })
        return response.idToken
      } catch (popupError) {
        console.error('Failed to acquire token via popup:', popupError)
        return null
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        getAccessToken,
        mode: 'prod',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Development Auth Provider with mock authentication
function DevAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    // Check if we have a token in sessionStorage
    const storedToken = sessionStorage.getItem('dev_access_token')
    const storedUser = sessionStorage.getItem('dev_user')
    
    if (storedToken && storedUser) {
      setAccessToken(storedToken)
      setUser(JSON.parse(storedUser))
      setIsAuthenticated(true)
    }
  }, [])

  const login = () => {
    // Show a simple prompt to select a user
    if (!authConfig?.users) return

    const userList = authConfig.users.map((u: MockUser, idx: number) => 
      `${idx + 1}. ${u.name} (${u.email})`
    ).join('\n')

    const selection = prompt(`Select a user to login:\n\n${userList}\n\nEnter number (1-${authConfig.users.length}):`)
    
    if (!selection) return

    const index = parseInt(selection) - 1
    if (index >= 0 && index < authConfig.users.length) {
      const selectedUser = authConfig.users[index]
      
      // Make a request to get the token
      fetch('/api/auth/dev/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'mock-code',
          username: selectedUser.sub,
        }),
      })
        .then(res => res.json())
        .then(data => {
          const token = data.access_token
          const userInfo = {
            email: selectedUser.email,
            name: selectedUser.name,
          }
          
          sessionStorage.setItem('dev_access_token', token)
          sessionStorage.setItem('dev_user', JSON.stringify(userInfo))
          
          setAccessToken(token)
          setUser(userInfo)
          setIsAuthenticated(true)
        })
        .catch(error => {
          console.error('Failed to get dev token:', error)
          alert('Failed to login. Please try again.')
        })
    }
  }

  const logout = () => {
    sessionStorage.removeItem('dev_access_token')
    sessionStorage.removeItem('dev_user')
    setAccessToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  const getAccessToken = async (): Promise<string | null> => {
    return accessToken
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        getAccessToken,
        mode: 'dev',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Main Auth Provider that chooses between dev and prod
interface AuthProviderProps {
  msalInstance: PublicClientApplication | null
  children: ReactNode
}

export function AuthProvider({ msalInstance, children }: AuthProviderProps) {
  if (authConfig?.mode === 'prod' && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <ProdAuthContent>{children}</ProdAuthContent>
      </MsalProvider>
    )
  } else {
    return <DevAuthProvider>{children}</DevAuthProvider>
  }
}
