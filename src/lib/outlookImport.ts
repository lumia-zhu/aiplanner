import { microsoftAuth } from './microsoftAuth'
import type { Task, TaskInput } from '@/types'

// Outlook 任务的数据结构（简化版）
export interface OutlookTask {
  id: string
  title: string
  body?: {
    content: string
    contentType: string
  }
  importance: 'low' | 'normal' | 'high'
  status: 'notStarted' | 'inProgress' | 'completed'
  dueDateTime?: {
    dateTime: string
    timeZone: string
  }
  createdDateTime: string
  lastModifiedDateTime: string
}

// 导入结果统计
export interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: number
  errorDetails: string[]
}

class OutlookImportService {
  // 获取 Outlook 任务列表
  async getOutlookTasks(): Promise<OutlookTask[]> {
    try {
      console.log('🔍 开始获取 Outlook 任务...')
      
      // 确保已登录
      if (!microsoftAuth.isLoggedIn()) {
        console.log('🔐 用户未登录，开始登录流程...')
        await microsoftAuth.login()
      }

      const graphClient = await microsoftAuth.createGraphClient()
      
      // 首先测试基本的用户信息访问
      console.log('🧪 测试用户信息访问...')
      try {
        const userResponse = await graphClient.api('/me').get()
        console.log('✅ 用户信息获取成功:', userResponse.displayName || userResponse.userPrincipalName)
      } catch (userError) {
        console.error('❌ 用户信息获取失败:', userError)
        throw new Error('无法访问用户信息，请检查权限配置')
      }
      
      // 获取用户的任务列表
      console.log('📋 获取任务列表...')
      try {
        const response = await graphClient
          .api('/me/todo/lists')
          .get()

        console.log('📋 任务列表响应:', response)

        // 获取默认任务列表中的任务
        if (response.value && response.value.length > 0) {
          const defaultListId = response.value[0].id
          console.log('📝 使用默认任务列表:', defaultListId)
          
          // 先尝试基础请求，不使用 select 参数
          let tasksResponse
          try {
            tasksResponse = await graphClient
              .api(`/me/todo/lists/${defaultListId}/tasks`)
              .top(50)
              .get()
            console.log('✅ 基础任务请求成功')
          } catch (basicError) {
            console.log('⚠️ 基础请求失败，尝试最简单的请求...')
            tasksResponse = await graphClient
              .api(`/me/todo/lists/${defaultListId}/tasks`)
              .get()
          }

          console.log('✅ 获取到 Outlook 任务:', tasksResponse.value?.length || 0, '个')
          return tasksResponse.value || []
        } else {
          console.log('📭 没有找到任务列表')
          return []
        }
      } catch (apiError: any) {
        console.error('❌ Microsoft Graph API 调用失败:', {
          message: apiError.message,
          code: apiError.code,
          statusCode: apiError.statusCode,
          requestId: apiError.requestId,
          date: apiError.date
        })
        
        // 根据错误类型提供更具体的错误信息
        if (apiError.code === 'Forbidden' || apiError.statusCode === 403) {
          throw new Error('权限不足：请确保应用已获得 Tasks.Read 权限并且用户已同意授权')
        } else if (apiError.code === 'Unauthorized' || apiError.statusCode === 401) {
          throw new Error('认证失败：请重新登录 Microsoft 账户')
        } else if (apiError.code === 'NotFound' || apiError.statusCode === 404) {
          throw new Error('找不到资源：可能是 API 端点不正确或用户没有 Outlook 任务')
        } else {
          throw new Error(`API 调用失败: ${apiError.message || 'Unknown error'}`)
        }
      }

    } catch (error: any) {
      console.error('❌ 获取 Outlook 任务失败:', error)
      // 重新抛出错误，保持原始错误信息
      throw error
    }
  }

  // 将 Outlook 任务转换为本地任务格式
  private convertOutlookTaskToLocal(outlookTask: OutlookTask): TaskInput {
    // 转换优先级
    let priority: 'low' | 'medium' | 'high' = 'medium'
    switch (outlookTask.importance) {
      case 'low':
        priority = 'low'
        break
      case 'high':
        priority = 'high'
        break
      default:
        priority = 'medium'
    }

    // 转换截止时间
    let deadline_time: string | undefined
    if (outlookTask.dueDateTime) {
      try {
        const dueDate = new Date(outlookTask.dueDateTime.dateTime)
        // 只提取时间部分（HH:MM）
        const hours = dueDate.getHours().toString().padStart(2, '0')
        const minutes = dueDate.getMinutes().toString().padStart(2, '0')
        deadline_time = `${hours}:${minutes}`
      } catch (error) {
        console.warn('⚠️ 解析截止时间失败:', outlookTask.dueDateTime, error)
      }
    }

    return {
      title: outlookTask.title || '未命名任务',
      description: outlookTask.body?.content || undefined,
      deadline_time,
      priority,
      completed: outlookTask.status === 'completed',
    }
  }

  // 检查任务是否已存在（基于标题和描述的相似性）
  private isTaskDuplicate(newTask: TaskInput, existingTasks: Task[]): boolean {
    return existingTasks.some(existing => {
      // 简单的重复检测：标题完全相同
      if (existing.title.toLowerCase().trim() === newTask.title.toLowerCase().trim()) {
        return true
      }
      
      // 如果有描述，也检查描述的相似性
      if (newTask.description && existing.description) {
        const newDesc = newTask.description.toLowerCase().trim()
        const existingDesc = existing.description.toLowerCase().trim()
        if (newDesc === existingDesc) {
          return true
        }
      }
      
      return false
    })
  }

  // 导入选中的任务
  async importSelectedTasks(
    selectedTasks: TaskInput[],
    existingTasks: Task[],
    onProgress?: (current: number, total: number, taskTitle: string) => void,
    createTaskFn?: (taskData: TaskInput) => Promise<{ task?: Task; error?: string }>
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    }

    try {
      console.log('🚀 开始导入选中的任务...')
      
      result.total = selectedTasks.length

      if (selectedTasks.length === 0) {
        console.log('📭 没有选中任何任务')
        return result
      }

      console.log(`📥 准备导入 ${selectedTasks.length} 个选中的任务`)

      // 逐个处理任务
      for (let i = 0; i < selectedTasks.length; i++) {
        const taskData = selectedTasks[i]
        
        try {
          // 报告进度
          onProgress?.(i + 1, selectedTasks.length, taskData.title)

          // 检查是否重复
          if (this.isTaskDuplicate(taskData, existingTasks)) {
            console.log(`⏭️  跳过重复任务: ${taskData.title}`)
            result.skipped++
            continue
          }

          // 创建任务
          if (createTaskFn) {
            const createResult = await createTaskFn(taskData)
            
            if (createResult.error) {
              console.error(`❌ 创建任务失败: ${taskData.title}`, createResult.error)
              result.errors++
              result.errorDetails.push(`${taskData.title}: ${createResult.error}`)
            } else {
              console.log(`✅ 成功导入任务: ${taskData.title}`)
              result.imported++
              
              // 将新创建的任务添加到现有任务列表中，用于后续的重复检测
              if (createResult.task) {
                existingTasks.push(createResult.task)
              }
            }
          } else {
            // 如果没有提供创建函数，只是模拟导入
            result.imported++
          }

          // 添加小延迟，避免过快的API调用
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`❌ 处理任务失败: ${taskData.title}`, error)
          result.errors++
          result.errorDetails.push(`${taskData.title}: ${error}`)
        }
      }

      console.log('🎉 选中任务导入完成:', result)
      return result

    } catch (error) {
      console.error('❌ 导入过程出现严重错误:', error)
      result.errors++
      result.errorDetails.push(`导入过程错误: ${error}`)
      return result
    }
  }

  // 导入 Outlook 任务到本地（保留原方法以向后兼容）
  async importTasks(
    existingTasks: Task[],
    onProgress?: (current: number, total: number, taskTitle: string) => void,
    createTaskFn?: (taskData: TaskInput) => Promise<{ task?: Task; error?: string }>
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    }

    try {
      console.log('🚀 开始导入 Outlook 任务...')
      
      // 获取 Outlook 任务
      const outlookTasks = await this.getOutlookTasks()
      result.total = outlookTasks.length

      if (outlookTasks.length === 0) {
        console.log('📭 没有找到 Outlook 任务')
        return result
      }

      console.log(`📥 准备导入 ${outlookTasks.length} 个任务`)

      // 逐个处理任务
      for (let i = 0; i < outlookTasks.length; i++) {
        const outlookTask = outlookTasks[i]
        
        try {
          // 报告进度
          onProgress?.(i + 1, outlookTasks.length, outlookTask.title)

          // 转换任务格式
          const localTask = this.convertOutlookTaskToLocal(outlookTask)

          // 检查是否重复
          if (this.isTaskDuplicate(localTask, existingTasks)) {
            console.log(`⏭️  跳过重复任务: ${localTask.title}`)
            result.skipped++
            continue
          }

          // 创建任务
          if (createTaskFn) {
            const createResult = await createTaskFn(localTask)
            
            if (createResult.error) {
              console.error(`❌ 创建任务失败: ${localTask.title}`, createResult.error)
              result.errors++
              result.errorDetails.push(`${localTask.title}: ${createResult.error}`)
            } else {
              console.log(`✅ 成功导入任务: ${localTask.title}`)
              result.imported++
              
              // 将新创建的任务添加到现有任务列表中，用于后续的重复检测
              if (createResult.task) {
                existingTasks.push(createResult.task)
              }
            }
          } else {
            // 如果没有提供创建函数，只是模拟导入
            result.imported++
          }

          // 添加小延迟，避免过快的API调用
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`❌ 处理任务失败: ${outlookTask.title}`, error)
          result.errors++
          result.errorDetails.push(`${outlookTask.title}: ${error}`)
        }
      }

      console.log('🎉 Outlook 任务导入完成:', result)
      return result

    } catch (error) {
      console.error('❌ 导入过程出现严重错误:', error)
      result.errors++
      result.errorDetails.push(`导入过程错误: ${error}`)
      return result
    }
  }

  // 预览要导入的任务（不实际创建）
  async previewImportTasks(): Promise<TaskInput[]> {
    try {
      const outlookTasks = await this.getOutlookTasks()
      return outlookTasks.map(task => this.convertOutlookTaskToLocal(task))
    } catch (error) {
      console.error('❌ 预览导入任务失败:', error)
      throw error
    }
  }
}

// 创建单例实例
export const outlookImport = new OutlookImportService()
