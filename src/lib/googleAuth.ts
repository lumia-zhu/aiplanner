'use client'

// 声明全局类型
declare global {
  interface Window {
    gapi: any
    google: any
  }
}

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
  private tokenClient: any = null
  private isInitialized = false
  private currentUser: GoogleUser | null = null
  private accessToken: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeGoogleServices()
    }
  }

  // 使用新的Google Identity Services初始化
  private async initializeGoogleServices(): Promise<void> {
    try {
      // 检查配置
      if (!GOOGLE_CONFIG.clientId) {
        throw new Error('缺少 Google Client ID')
      }

      console.log('开始初始化新的Google Identity Services...')
      console.log('配置信息:', {
        hasClientId: !!GOOGLE_CONFIG.clientId,
        clientIdLength: GOOGLE_CONFIG.clientId?.length,
        hasApiKey: !!GOOGLE_CONFIG.apiKey
      })
      
      // 加载新的Google Identity Services和gapi
      await this.loadGoogleScripts()

      // 初始化gapi client（用于API调用）
      if (GOOGLE_CONFIG.apiKey) {
        console.log('初始化gapi client...')
        await new Promise<void>((resolve, reject) => {
          window.gapi.load('client', {
            callback: async () => {
              try {
                await window.gapi.client.init({
                  apiKey: GOOGLE_CONFIG.apiKey,
                  discoveryDocs: [GOOGLE_CONFIG.discoveryDoc]
                })
                console.log('gapi client初始化成功')
                resolve()
              } catch (error) {
                console.error('gapi client初始化失败:', error)
                reject(error)
              }
            },
            onerror: reject
          })
        })
      }

      // 初始化OAuth2 token client
      console.log('初始化OAuth2 token client...')
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.clientId,
        scope: GOOGLE_CONFIG.scope,
        callback: (response: any) => {
          console.log('OAuth2回调响应:', response)
          if (response.access_token) {
            this.accessToken = response.access_token
            this.handleAuthSuccess(response)
          }
        },
        error_callback: (error: any) => {
          console.error('OAuth2错误:', error)
        }
      })

      this.gapi = window.gapi
      this.isInitialized = true
      console.log('新的Google Identity Services初始化成功')
    } catch (error) {
      console.error('Google Identity Services初始化失败:', {
        error,
        errorMessage: (error as Error)?.message,
        errorStack: (error as Error)?.stack
      })
      
      throw new Error(`Google Identity Services初始化失败: ${(error as Error)?.message || String(error)}`)
    }
  }

  // 处理认证成功
  private async handleAuthSuccess(response: any) {
    try {
      // 使用access token获取用户信息
      const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`)
      const userInfo = await userInfoResponse.json()
      
      this.currentUser = {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture
      }
      
      console.log('用户信息获取成功:', this.currentUser)
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  // 加载Google脚本
  private loadGoogleScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptsToLoad = [
        'https://accounts.google.com/gsi/client',
        'https://apis.google.com/js/api.js'
      ]
      
      let loadedCount = 0
      
      const checkComplete = () => {
        loadedCount++
        if (loadedCount === scriptsToLoad.length) {
          console.log('所有Google脚本加载完成')
          // 等待脚本完全初始化
          setTimeout(() => resolve(), 300)
        }
      }
      
      scriptsToLoad.forEach((src, index) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = () => {
          console.log(`脚本 ${index + 1} 加载成功:`, src)
          checkComplete()
        }
        script.onerror = (event) => {
          console.error(`脚本 ${index + 1} 加载失败:`, src, event)
          reject(new Error(`Failed to load script: ${src}`))
        }
        
        document.head.appendChild(script)
      })
      
      console.log('开始加载Google脚本...')
    })
  }

  // 检查是否已认证
  public isSignedIn(): boolean {
    return !!(this.isInitialized && this.accessToken && this.currentUser)
  }

  // 登录
  public async signIn(): Promise<GoogleUser> {
    if (!this.isInitialized) {
      await this.initializeGoogleServices()
    }

    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Token client未初始化'))
        return
      }

      // 更新回调以处理Promise
      this.tokenClient.callback = async (response: any) => {
        console.log('登录响应:', response)
        if (response.access_token) {
          this.accessToken = response.access_token
          await this.handleAuthSuccess(response)
          if (this.currentUser) {
            resolve(this.currentUser)
          } else {
            reject(new Error('获取用户信息失败'))
          }
        } else if (response.error) {
          reject(new Error(`登录失败: ${response.error}`))
        } else {
          reject(new Error('登录被取消或失败'))
        }
      }

      // 触发登录流程
      console.log('开始OAuth2登录流程...')
      this.tokenClient.requestAccessToken()
    })
  }

  // 登出
  public async signOut(): Promise<void> {
    if (this.accessToken) {
      // 撤销令牌
      window.google?.accounts.oauth2.revoke(this.accessToken)
    }
    
    this.accessToken = null
    this.currentUser = null
    console.log('用户已登出')
  }

  // 获取当前用户
  public getCurrentUser(): GoogleUser | null {
    return this.currentUser
  }

  // 获取访问令牌
  public getAccessToken(): string | null {
    return this.accessToken
  }

  // 检查配置是否完整
  public isConfigured(): boolean {
    return !!GOOGLE_CONFIG.clientId
  }

  // 获取错误信息
  public getConfigError(): string | null {
    if (!GOOGLE_CONFIG.clientId) {
      return '缺少 Google Client ID，请在 .env.local 中配置 NEXT_PUBLIC_GOOGLE_CLIENT_ID'
    }
    return null
  }

  // 获取配置信息（用于调试）
  public getConfigInfo(): any {
    return {
      hasClientId: !!GOOGLE_CONFIG.clientId,
      hasApiKey: !!GOOGLE_CONFIG.apiKey,
      clientIdPrefix: GOOGLE_CONFIG.clientId ? GOOGLE_CONFIG.clientId.substring(0, 10) + '...' : 'undefined',
      apiKeyPrefix: GOOGLE_CONFIG.apiKey ? GOOGLE_CONFIG.apiKey.substring(0, 10) + '...' : 'undefined'
    }
  }
}

// 导出单例实例
export const googleAuthService = new GoogleAuthService()
export type { GoogleUser }
