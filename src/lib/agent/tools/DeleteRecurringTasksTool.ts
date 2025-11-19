/**
 * DeleteRecurringTasksTool - 批量删除任务工具
 * 
 * 功能：在多个日期批量删除符合条件的任务
 * 用途：处理"删除这周所有X任务"等批量删除场景
 */

import { AgentTool, ParameterSchema, ToolResult } from '../AgentTypes'
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

interface DeleteRecurringTasksParams {
  userId: string
  searchKeyword?: string  // ⭐ 查找关键词（可选）。如果提供，只删除标题包含此关键词的任务；如果不提供或为空，删除所有任务
  dateRange: 'today' | 'this_week' | 'next_week' | 'this_month' | 'custom'
  startDate?: string  // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  endDate?: string    // YYYY-MM-DD，仅当 dateRange='custom' 时使用
  onlyCompleted?: boolean  // 可选：是否只删除已完成的任务（默认 false，删除所有匹配的任务）
}

/**
 * 批量删除任务工具
 * 
 * 支持场景：
 * - "删除这周所有'锻炼'任务"
 * - "删除本月所有已完成的'吃饭'任务"
 * - "删除下周所有关于'工作'的任务"
 */
export class DeleteRecurringTasksTool implements AgentTool {
  name = 'delete_recurring_tasks'
  description = '在多个日期批量删除任务。⚠️ 重要：searchKeyword 是可选的！只有当用户说"删除所有XX任务"（指定了任务类型）时才传searchKeyword；如果用户说"删除所有任务"（没有指定任务类型），则不传searchKeyword。'
  
  parameters: ParameterSchema = {
    type: 'object',
    properties: {
      userId: { 
        type: 'string', 
        description: '用户 ID（必需）' 
      },
      searchKeyword: {
        type: 'string',
        description: '⭐ 搜索关键词（可选）。⚠️ 仅当用户指定了具体的任务类型时才传此参数！例如："删除所有锻炼任务" → searchKeyword="锻炼"；"删除所有任务" → 不传searchKeyword。❌ 不要把"所有任务"、"全部任务"当作searchKeyword！'
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
      onlyCompleted: {
        type: 'boolean',
        description: '是否只删除已完成的任务（可选，默认 false）。如果为 true，只删除已完成的任务；如果为 false，删除所有匹配的任务'
      }
    },
    required: ['userId', 'dateRange']  // ⭐ searchKeyword 不再是必填
  }

  async execute(params: DeleteRecurringTasksParams): Promise<ToolResult> {
    try {
      console.log('🗑️ DeleteRecurringTasksTool 执行:', {
        userId: params.userId.substring(0, 8) + '...',
        searchKeyword: params.searchKeyword,
        dateRange: params.dateRange,
        onlyCompleted: params.onlyCompleted || false
      })

      // 1. 验证参数（searchKeyword 现在是可选的）
      const searchKeyword = params.searchKeyword?.trim() || ''  // 空字符串表示匹配所有任务
      const matchAll = searchKeyword === ''  // 是否匹配所有任务

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
      console.log(`📅 将在 ${dates.length} 天内删除任务`)

      // 4. 批量删除任务
      const { getNoteByDate, saveNote, formatNoteDate } = await import('@/lib/notes')
      
      const results = []
      let totalDeleted = 0

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
              deleted: 0,
              message: '没有笔记'
            })
            continue
          }

          // 查找并删除匹配的任务
          let noteUpdated = false
          let deletedCount = 0
          
          const updatedContent = this.deleteTasksInContent(
            note.content,
            searchKeyword,
            matchAll,
            params.onlyCompleted || false,
            (count) => {
              deletedCount = count
              noteUpdated = count > 0
            }
          )

          if (noteUpdated) {
            // 保存更新后的笔记
            await saveNote(params.userId, date, updatedContent)
            console.log(`✅ ${dateStr}: 删除了 ${deletedCount} 个任务`)
            totalDeleted += deletedCount
            
            results.push({
              date: dateStr,
              success: true,
              deleted: deletedCount,
              message: `删除了 ${deletedCount} 个任务`
            })
          } else {
            console.log(`📭 ${dateStr}: 没有匹配的任务`)
            results.push({
              date: dateStr,
              success: true,
              deleted: 0,
              message: '没有匹配的任务'
            })
          }
          
        } catch (error) {
          console.error(`❌ ${dateStr}: 删除失败:`, error)
          results.push({
            date: dateStr,
            success: false,
            deleted: 0,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      // 5. 构建返回消息
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      let message = `✅ 批量删除完成！\n`
      message += matchAll 
        ? `🔍 删除范围：所有任务\n`
        : `🔍 搜索关键词：${searchKeyword}\n`
      message += `📅 日期范围：${formatNoteDate(startDate)} 至 ${formatNoteDate(endDate)}\n`
      message += `📊 总共删除：${totalDeleted} 个任务\n`
      
      if (params.onlyCompleted) {
        message += `✓ 删除范围：仅已完成的任务\n`
      }
      
      if (failCount > 0) {
        message += `\n⚠️ 失败：${failCount} 天`
      }

      console.log(`✅ 批量删除完成: 删除了 ${totalDeleted} 个任务`)

      return {
        type: 'success',
        message,
        data: {
          searchKeyword: searchKeyword || '(所有任务)',
          matchAll,
          dateRange: params.dateRange,
          startDate: formatNoteDate(startDate),
          endDate: formatNoteDate(endDate),
          totalDays: dates.length,
          totalDeleted,
          successCount,
          failCount,
          onlyCompleted: params.onlyCompleted || false,
          results
        }
      }
    } catch (error) {
      console.error('❌ DeleteRecurringTasksTool 执行失败:', error)
      
      return {
        type: 'error',
        message: error instanceof Error ? `批量删除任务失败: ${error.message}` : '批量删除任务失败'
      }
    }
  }

  /**
   * 在 Tiptap JSON 内容中查找并删除匹配的任务
   */
  private deleteTasksInContent(
    content: any,
    searchKeyword: string,
    matchAll: boolean,  // ⭐ 新增：是否匹配所有任务
    onlyCompleted: boolean,
    onDeleteCount: (count: number) => void
  ): any {
    let deletedCount = 0
    
    const traverse = (node: any): any => {
      if (!node) return node

      // 如果是包含 taskItem 的容器（如 taskList）
      if (node.content && Array.isArray(node.content)) {
        const filteredContent = node.content.filter((child: any) => {
          // 如果是 taskItem 节点
          if (child.type === 'taskItem') {
            // 提取任务标题
            const taskTitle = this.extractTaskTitle(child)
            
            // ⭐ 检查是否匹配（匹配所有任务 或 标题包含关键词）
            const isMatch = matchAll || (taskTitle && taskTitle.includes(searchKeyword))
            
            if (isMatch) {
              // 如果设置了只删除已完成的任务，检查完成状态
              if (onlyCompleted) {
                const isCompleted = child.attrs?.checked === true
                if (isCompleted) {
                  deletedCount++
                  return false  // 删除此任务
                }
              } else {
                // 删除所有匹配的任务
                deletedCount++
                return false  // 删除此任务
              }
            }
          }
          
          return true  // 保留此节点
        })

        // 递归处理保留的子节点
        return {
          ...node,
          content: filteredContent.map((child: any) => traverse(child))
        }
      }

      return node
    }

    const updatedContent = traverse(content)
    onDeleteCount(deletedCount)
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
}




