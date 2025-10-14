/**
 * Prompt 管理器
 * 
 * 集中管理所有 AI Prompts，支持：
 * - 模板变量替换
 * - 版本管理
 * - A/B 测试
 */

/**
 * Prompt 模板接口
 */
export interface PromptTemplate {
  /** Prompt ID */
  id: string
  
  /** 版本号 */
  version: string
  
  /** 模板内容（支持 {{variable}} 占位符） */
  template: string
  
  /** 渲染函数 */
  render(variables: Record<string, any>): string
  
  /** 描述 */
  description?: string
}

/**
 * 基础 Prompt 模板类
 */
export class BasePromptTemplate implements PromptTemplate {
  id: string
  version: string
  template: string
  description?: string
  
  constructor(
    id: string,
    version: string,
    template: string,
    description?: string
  ) {
    this.id = id
    this.version = version
    this.template = template
    this.description = description
  }
  
  /**
   * 渲染模板
   * 
   * 将 {{variable}} 替换为实际值
   */
  render(variables: Record<string, any>): string {
    let result = this.template
    
    // 替换所有 {{variable}} 占位符
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, String(value))
    }
    
    return result
  }
}

/**
 * Prompt 管理器
 */
export class PromptManager {
  private prompts: Map<string, Map<string, PromptTemplate>>
  private activeVersions: Map<string, string>
  
  constructor() {
    this.prompts = new Map()
    this.activeVersions = new Map()
  }
  
  /**
   * 注册 Prompt 模板
   */
  register(template: PromptTemplate): void {
    if (!this.prompts.has(template.id)) {
      this.prompts.set(template.id, new Map())
    }
    
    const versions = this.prompts.get(template.id)!
    versions.set(template.version, template)
    
    // 如果没有设置活跃版本，使用第一个版本
    if (!this.activeVersions.has(template.id)) {
      this.activeVersions.set(template.id, template.version)
    }
    
    console.log(`✅ 注册 Prompt: ${template.id} (${template.version})`)
  }
  
  /**
   * 获取 Prompt 模板
   */
  get(id: string, version?: string): PromptTemplate | null {
    const versions = this.prompts.get(id)
    if (!versions) return null
    
    const targetVersion = version || this.activeVersions.get(id)
    if (!targetVersion) return null
    
    return versions.get(targetVersion) || null
  }
  
  /**
   * 渲染 Prompt
   */
  render(id: string, variables: Record<string, any>, version?: string): string {
    const template = this.get(id, version)
    
    if (!template) {
      throw new Error(`Prompt ${id} 未找到`)
    }
    
    return template.render(variables)
  }
  
  /**
   * 设置活跃版本（用于 A/B 测试）
   */
  setActiveVersion(id: string, version: string): void {
    const versions = this.prompts.get(id)
    if (!versions || !versions.has(version)) {
      throw new Error(`Prompt ${id} 的版本 ${version} 不存在`)
    }
    
    this.activeVersions.set(id, version)
    console.log(`🔄 切换 Prompt 版本: ${id} → ${version}`)
  }
  
  /**
   * 获取所有已注册的 Prompt ID
   */
  getAllIds(): string[] {
    return Array.from(this.prompts.keys())
  }
  
  /**
   * 获取指定 Prompt 的所有版本
   */
  getVersions(id: string): string[] {
    const versions = this.prompts.get(id)
    return versions ? Array.from(versions.keys()) : []
  }
}

// 创建全局单例
export const promptManager = new PromptManager()

