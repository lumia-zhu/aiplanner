import { PublicClientApplication, Configuration, AccountInfo } from '@azure/msal-browser'
import { Client } from '@microsoft/microsoft-graph-client'

// Microsoft Graph 配置
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '', // 需要在 Azure AD 中注册应用获取
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// 请求的权限范围
const loginRequest = {
  scopes: [
    'User.Read',           // 读取用户基本信息
    'Tasks.Read',          // 读取用户任务
    'Tasks.ReadWrite'      // 读写用户任务（某些情况下需要）
  ],
}

class MicrosoftAuthService {
  private msalInstance: PublicClientApplication
  private graphClient: Client | null = null

  constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig)
  }

  // 初始化 MSAL
  async initialize() {
    try {
      await this.msalInstance.initialize()
      console.log('✅ Microsoft Auth 初始化成功')
    } catch (error) {
      console.error('❌ Microsoft Auth 初始化失败:', error)
      throw error
    }
  }

  // 登录到 Microsoft 账户
  async login(): Promise<AccountInfo | null> {
    try {
      // 检查是否已有活跃账户
      const accounts = this.msalInstance.getAllAccounts()
      if (accounts.length > 0) {
        console.log('✅ 找到已存在的 Microsoft 账户')
        return accounts[0]
      }

      // 弹出登录窗口
      const loginResponse = await this.msalInstance.loginPopup(loginRequest)
      console.log('✅ Microsoft 登录成功:', loginResponse.account?.username)
      
      return loginResponse.account
    } catch (error) {
      console.error('❌ Microsoft 登录失败:', error)
      throw error
    }
  }

  // 获取访问令牌
  async getAccessToken(): Promise<string> {
    try {
      const accounts = this.msalInstance.getAllAccounts()
      if (accounts.length === 0) {
        throw new Error('未找到已登录的 Microsoft 账户')
      }

      const silentRequest = {
        ...loginRequest,
        account: accounts[0],
      }

      const response = await this.msalInstance.acquireTokenSilent(silentRequest)
      return response.accessToken
    } catch (error) {
      console.error('❌ 获取访问令牌失败:', error)
      // 如果静默获取失败，尝试交互式获取
      try {
        const response = await this.msalInstance.acquireTokenPopup(loginRequest)
        return response.accessToken
      } catch (popupError) {
        console.error('❌ 弹窗获取令牌也失败:', popupError)
        throw popupError
      }
    }
  }

  // 创建 Graph 客户端
  async createGraphClient(): Promise<Client> {
    if (this.graphClient) {
      return this.graphClient
    }

    const accessToken = await this.getAccessToken()
    
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })

    return this.graphClient
  }

  // 获取当前登录的账户
  getCurrentAccount(): AccountInfo | null {
    const accounts = this.msalInstance.getAllAccounts()
    return accounts.length > 0 ? accounts[0] : null
  }

  // 登出
  async logout() {
    try {
      const accounts = this.msalInstance.getAllAccounts()
      if (accounts.length > 0) {
        await this.msalInstance.logoutPopup({
          account: accounts[0],
        })
        this.graphClient = null
        console.log('✅ Microsoft 登出成功')
      }
    } catch (error) {
      console.error('❌ Microsoft 登出失败:', error)
      throw error
    }
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    return this.msalInstance.getAllAccounts().length > 0
  }
}

// 创建单例实例
export const microsoftAuth = new MicrosoftAuthService()

// 初始化（在客户端环境中）
if (typeof window !== 'undefined') {
  microsoftAuth.initialize().catch(console.error)
}
