'use client'

// Google Calendar API 认证配置
const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
  discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
}

interface GoogleUser {
  id: string
  name: string
  email: string
  picture?: string
}

class GoogleAuthService {
  private gapi: any = null
  private isInitialized = false
  private currentUser: GoogleUser | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeGapi()
    }
  }

  // 初始化Google API
  private async initializeGapi(): Promise<void> {
    try {
      // 动态加载Google API脚本
      if (!window.gapi) {
        await this.loadGapiScript()
      }

      this.gapi = window.gapi

      // 初始化gapi
      await new Promise<void>((resolve, reject) => {
        this.gapi.load('auth2:client', {
          callback: resolve,
          onerror: reject
        })
      })

      // 初始化客户端
      await this.gapi.client.init({
        apiKey: GOOGLE_CONFIG.apiKey,
        clientId: GOOGLE_CONFIG.clientId,
        discoveryDocs: [GOOGLE_CONFIG.discoveryDoc],
        scope: GOOGLE_CONFIG.scope
      })

      this.isInitialized = true
      console.log('Google API 初始化成功')
    } catch (error) {
      console.error('Google API 初始化失败:', error)
      throw error
    }
  }

  // 动态加载Google API脚本
  private loadGapiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API script'))
      document.head.appendChild(script)
    })
  }

  // 检查是否已认证
  public isSignedIn(): boolean {
    if (!this.isInitialized || !this.gapi) return false
    
    const authInstance = this.gapi.auth2.getAuthInstance()
    return authInstance && authInstance.isSignedIn.get()
  }

  // 登录
  public async signIn(): Promise<GoogleUser> {
    if (!this.isInitialized) {
      await this.initializeGapi()
    }

    try {
      const authInstance = this.gapi.auth2.getAuthInstance()
      const googleUser = await authInstance.signIn()
      
      const profile = googleUser.getBasicProfile()
      this.currentUser = {
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        picture: profile.getImageUrl()
      }

      return this.currentUser
    } catch (error) {
      console.error('Google 登录失败:', error)
      throw error
    }
  }

  // 登出
  public async signOut(): Promise<void> {
    if (!this.isInitialized) return

    try {
      const authInstance = this.gapi.auth2.getAuthInstance()
      await authInstance.signOut()
      this.currentUser = null
    } catch (error) {
      console.error('Google 登出失败:', error)
      throw error
    }
  }

  // 获取当前用户
  public getCurrentUser(): GoogleUser | null {
    if (!this.isSignedIn()) return null

    if (!this.currentUser && this.gapi) {
      const authInstance = this.gapi.auth2.getAuthInstance()
      const googleUser = authInstance.currentUser.get()
      const profile = googleUser.getBasicProfile()
      
      this.currentUser = {
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        picture: profile.getImageUrl()
      }
    }

    return this.currentUser
  }

  // 获取访问令牌
  public getAccessToken(): string | null {
    if (!this.isSignedIn()) return null

    const authInstance = this.gapi.auth2.getAuthInstance()
    const googleUser = authInstance.currentUser.get()
    const authResponse = googleUser.getAuthResponse()
    
    return authResponse.access_token
  }

  // 检查配置是否完整
  public isConfigured(): boolean {
    return !!(GOOGLE_CONFIG.clientId && GOOGLE_CONFIG.apiKey)
  }

  // 获取错误信息
  public getConfigError(): string | null {
    if (!GOOGLE_CONFIG.clientId) {
      return '缺少 Google Client ID，请在 .env.local 中配置 NEXT_PUBLIC_GOOGLE_CLIENT_ID'
    }
    if (!GOOGLE_CONFIG.apiKey) {
      return '缺少 Google API Key，请在 .env.local 中配置 NEXT_PUBLIC_GOOGLE_API_KEY'
    }
    return null
  }
}

// 导出单例实例
export const googleAuthService = new GoogleAuthService()
export type { GoogleUser }
