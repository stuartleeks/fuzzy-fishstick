// Authentication configuration types and interfaces

import type { Configuration } from '@azure/msal-browser'

export interface AuthConfig {
  mode: 'dev' | 'prod'
  tenantId?: string
  clientId: string
  authority: string
  users?: MockUser[]
}

export interface MockUser {
  email: string
  name: string
  sub: string
}

export interface UserInfo {
  email: string
  name?: string
}

// MSAL configuration will be built dynamically after fetching from backend
export let msalConfig: Configuration | null = null
export let authConfig: AuthConfig | null = null

export async function initializeAuth(): Promise<AuthConfig> {
  const response = await fetch('/api/auth/config')
  const config = await response.json()
  
  authConfig = config
  
  if (config.mode === 'prod') {
    // Production mode - Entra ID
    msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    }
  } else {
    // Development mode - Mock auth
    msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    }
  }
  
  return config
}
