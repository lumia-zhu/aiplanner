/**
 * UpdateRecurringTasksTool - 批量更新任务工具
 * 
 * 功能：在多个日期批量更新符合条件的任务
 * 用途：处理"把这周所有X任务改成Y"等批量更新场景
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

interface UpdateRecurringTasksParams {
  userId: string
  searchKeyword: string  // 查找关键词（任务标题包含此关键词的任务将被更新）
  dateRange: 'today' | 'this_week' | 'next_week' | 'this_month' | 'custom'
  startDate?: string  // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  endDate?: string    // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  updateFields: {
    newTitle?: string       // 新标题（如果提供，将替换整个标题）
    completed?: boolean     // 完成状态（true=标记为完成，false=标记为未完成）
  }
}

/**
 * 批量更新任务工具
 * 
 * 支持场景：
 * - "把这周所有'锻炼'任务改成'跑步'"
 * - "把本月所有未完成的'吃饭'任务标记为完成"
 * - "把下周所有关于'工作'的任务改为'开会'"
 */
export class UpdateRecurringTasksTool implements AgentTool {
  name = 'update_recurring_tasks'
  description = '在多个日期批量更新符合条件的任务。可以批量修改任务标题或完成状态。适用于"这周"、"下周"、"本月"等场景。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      searchKeyword: {
        type: 'string',
        description: '搜索关键词（必需）。只有任务标题包含此关键词的任务会被更新。例如："锻炼"、"吃饭"、"工作"'
      },
      dateRange: {
        type: 'string',
        enum: ['today', 'this_week', 'next_week', 'this_month', 'custom'],
        description: '日期范围（必需）。this_week=本周每天，next_week=下周每天，this_month=本月每天，custom=自定义范围'
      },
      startDate: {
        type: 'string',
        description: '开始日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      },
      endDate: {
        type: 'string',
        description: '结束日期（可选），格式：YYYY-MM-DD。仅当 dateRange="custom" 时需要'
      },
      updateFields: {
        type: 'object',
        description: '要更新的字段（必需）。至少提供一个字段',
        properties: {
          newTitle: {
            type: 'string',
            description: '新任务标题（可选）。如果提供，将把匹配的任务标题改为此新标题'
          },
          completed: {
            type: 'boolean',
            description: '完成状态（可选）。true=标记为完成，false=标记为未完成'
          }
        }
      }
    },
    required: ['userId', 'searchKeyword', 'dateRange', 'updateFields']
  }

  async execute(params: UpdateRecurringTasksParams): Promise<ToolResult> {
    try {
      console.log('🔄 UpdateRecurringTasksTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        searchKeyword: params.searchKeyword,
        dateRange: params.dateRange,
        updateFields: params.updateFields
      })

      // 1. 验证参数
      if (!params.searchKeyword || params.searchKeyword.trim().length === 0) {
        return {
          type: 'error',
          message: '搜索关键词不能为空'
        }
      }

      if (!params.updateFields.newTitle && params.updateFields.completed === undefined) {
        return {
          type: 'error',
          message: '至少需要提供一个更新字段（newTitle 或 completed）'
        }
      }

      // 2. 计算日期范围
      let startDate: Date
      let endDate: Date
      const today = new Date()

      switch (params.dateRange) {
        case 'today':
          startDate = today
          endDate = today
          break

        case 'this_week':
          // 从今天到本周日
          startDate = today
          endDate = endOfWeek(today, { weekStartsOn: 1 })
          break

        case 'next_week':
          const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7)
          startDate = nextWeekStart
          endDate = endOfWeek(nextWeekStart, { weekStartsOn: 1 })
          break

        case 'this_month':
          startDate = today
          endDate = endOfMonth(today)
          break

        case 'custom':
          if (!params.startDate || !params.endDate) {
            return {
              type: 'error',
              message: '自定义范围需要提供 startDate 和 endDate'
            }
          }
          try {
            startDate = new Date(params.startDate)
            endDate = new Date(params.endDate)
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              throw new Error('无效日期')
            }
          } catch (error) {
            return {
              type: 'error',
              message: '日期格式错误，请使用 YYYY-MM-DD 格式'
            }
          }
          break

        default:
          return {
            type: 'error',
            message: `不支持的日期范围: ${params.dateRange}`
          }
      }

      // 3. 生成日期列表
      const dates = eachDayOfInterval({ start: startDate, end: endDate })
      console.log(`📅 将在 ${dates.length} 天内更新任务`)

      // 4. 批量更新任务
      const { getNoteByDate, saveNote, formatNoteDate } = await import('@/lib/notes')
      
      const results = []
      let totalUpdated = 0

      for (const date of dates) {
        const dateStr = formatNoteDate(date)
        
        try {
          // 加载笔记
          const note = await getNoteByDate(params.userId, date)
          
          if (!note || !note.content) {
            console.log(`📭 ${dateStr}: 没有笔记，跳过`)
            results.push({
              date: dateStr,
              success: true,
              updated: 0,
              message: '没有笔记'
            })
            continue
          }

          // 查找并更新匹配的任务
          let noteUpdated = false
          let updatedCount = 0
          
          const updatedContent = this.updateTasksInContent(
            note.content,
            params.searchKeyword,
            params.updateFields,
            (count) => {
              updatedCount = count
              noteUpdated = count > 0
            }
          )

          if (noteUpdated) {
            // 保存更新后的笔记
            await saveNote(params.userId, date, updatedContent)
            console.log(`✅ ${dateStr}: 更新了 ${updatedCount} 个任务`)
            totalUpdated += updatedCount
            
            results.push({
              date: dateStr,
              success: true,
              updated: updatedCount,
              message: `更新了 ${updatedCount} 个任务`
            })
          } else {
            console.log(`📭 ${dateStr}: 没有匹配的任务`)
            results.push({
              date: dateStr,
              success: true,
              updated: 0,
              message: '没有匹配的任务'
            })
          }
          
        } catch (error) {
          console.error(`❌ ${dateStr}: 更新失败:`, error)
          results.push({
            date: dateStr,
            success: false,
            updated: 0,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      // 5. 构建返回消息
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      let message = `✅ 批量更新完成！\n`
      message += `🔍 搜索关键词：${params.searchKeyword}\n`
      message += `📅 日期范围：${formatNoteDate(startDate)} 至 ${formatNoteDate(endDate)}\n`
      message += `📊 总共更新：${totalUpdated} 个任务\n`
      
      // 显示更新内容
      if (params.updateFields.newTitle) {
        message += `📝 新标题：${params.updateFields.newTitle}\n`
      }
      if (params.updateFields.completed !== undefined) {
        message += `✓ 完成状态：${params.updateFields.completed ? '已完成' : '未完成'}\n`
      }
      
      if (failCount > 0) {
        message += `\n⚠️ 失败：${failCount} 天`
      }

      console.log(`✅ 批量更新完成: 更新了 ${totalUpdated} 个任务`)

      return {
        type: 'success',
        message,
        data: {
          searchKeyword: params.searchKeyword,
          dateRange: params.dateRange,
          startDate: formatNoteDate(startDate),
          endDate: formatNoteDate(endDate),
          totalDays: dates.length,
          totalUpdated,
          successCount,
          failCount,
          updateFields: params.updateFields,
          results
        }
      }
    } catch (error) {
      console.error('❌ UpdateRecurringTasksTool 执行失败:', error)
      
      return {
        type: 'error',
        message: error instanceof Error ? `批量更新任务失败: ${error.message}` : '批量更新任务失败'
      }
    }
  }

  /**
   * 在 Tiptap JSON 内容中查找并更新匹配的任务
   */
  private updateTasksInContent(
    content: any,
    searchKeyword: string,
    updateFields: UpdateRecurringTasksParams['updateFields'],
    onUpdateCount: (count: number) => void
  ): any {
    let updatedCount = 0
    
    const traverse = (node: any): any => {
      if (!node) return node

      // 如果是 taskItem 节点
      if (node.type === 'taskItem') {
        // 提取任务标题
        const taskTitle = this.extractTaskTitle(node)
        
        // 检查是否匹配关键词
        if (taskTitle && taskTitle.includes(searchKeyword)) {
          // 更新任务
          const updatedNode = { ...node }
          
          // 更新标题
          if (updateFields.newTitle) {
            updatedNode.content = this.updateTaskTitle(node.content, updateFields.newTitle)
          }
          
          // 更新完成状态
          if (updateFields.completed !== undefined) {
            updatedNode.attrs = {
              ...updatedNode.attrs,
              checked: updateFields.completed
            }
          }
          
          updatedCount++
          return updatedNode
        }
      }

      // 递归处理子节点
      if (node.content && Array.isArray(node.content)) {
        return {
          ...node,
          content: node.content.map((child: any) => traverse(child))
        }
      }

      return node
    }

    const updatedContent = traverse(content)
    onUpdateCount(updatedCount)
    return updatedContent
  }

  /**
   * 提取任务标题
   */
  private extractTaskTitle(taskItemNode: any): string | null {
    if (!taskItemNode.content || !Array.isArray(taskItemNode.content)) {
      return null
    }

    // 遍历 taskItem 的 content，通常第一个是 paragraph
    for (const node of taskItemNode.content) {
      if (node.type === 'paragraph' && node.content && Array.isArray(node.content)) {
        // 提取所有文本节点
        const texts = node.content
          .filter((n: any) => n.type === 'text')
          .map((n: any) => n.text)
          .join('')
        
        return texts
      }
    }

    return null
  }

  /**
   * 更新任务标题
   */
  private updateTaskTitle(content: any[], newTitle: string): any[] {
    // 通常第一个节点是 paragraph
    if (content && content.length > 0 && content[0].type === 'paragraph') {
      return [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: newTitle
            }
          ]
        },
        ...content.slice(1)  // 保留其他节点（如时间节点等）
      ]
    }

    return content
  }
}







