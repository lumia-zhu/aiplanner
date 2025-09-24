import type { CanvasEvent, CanvasImportResult } from '@/types/canvas'
import type { Task } from '@/types'
import { parseICalSimple, parseICalDateTime, type SimpleICalEvent } from './icalParser'

// 尝试导入ical.js，如果失败则使用备用解析器
let ICAL: any = null
try {
  ICAL = require('ical.js')
} catch (error) {
  console.warn('ical.js库导入失败，将使用备用解析器:', error)
}

class CanvasImportService {
  /**
   * 从iCal URL解析Canvas事件
   */
  async parseICalFromUrl(url: string): Promise<CanvasEvent[]> {
    try {
      console.log('正在解析Canvas iCal URL:', url)
      
      // 通过API路由获取iCal数据，避免CORS问题
      const response = await fetch('/api/canvas-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.details || result.error || '获取iCal数据失败')
      }
      
      const icalData = result.data
      console.log('获取到iCal数据，长度:', icalData.length)
      
      let events: CanvasEvent[] = []
      
      // 尝试使用ical.js解析，如果失败则使用备用解析器
      if (ICAL) {
        try {
          console.log('使用ical.js解析iCal数据')
          const jcalData = ICAL.parse(icalData)
          const comp = new ICAL.Component(jcalData)
          const vevents = comp.getAllSubcomponents('vevent')
          
          console.log('解析到事件数量:', vevents.length)
          
          for (const vevent of vevents) {
            try {
              const event = this.convertICalEventToCanvasEvent(vevent)
              if (event) {
                events.push(event)
              }
            } catch (error) {
              console.warn('跳过无法解析的事件:', error)
            }
          }
        } catch (error) {
          console.warn('ical.js解析失败，尝试使用备用解析器:', error)
          events = this.parseWithFallbackParser(icalData)
        }
      } else {
        console.log('使用备用解析器解析iCal数据')
        events = this.parseWithFallbackParser(icalData)
      }
      
      console.log('成功解析的事件数量:', events.length)
      return events
      
    } catch (error) {
      console.error('解析iCal失败:', error)
      throw new Error(`解析Canvas日历失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 直接解析iCal文件内容（用于文件上传）
   */
  async parseICalFromFileContent(icalData: string): Promise<CanvasEvent[]> {
    try {
      console.log('直接解析iCal文件内容，长度:', icalData.length)
      
      let events: CanvasEvent[] = []
      
      // 尝试使用ical.js解析，如果失败则使用备用解析器
      if (ICAL) {
        try {
          console.log('使用ical.js解析iCal数据')
          const jcalData = ICAL.parse(icalData)
          const comp = new ICAL.Component(jcalData)
          const vevents = comp.getAllSubcomponents('vevent')
          
          console.log('解析到事件数量:', vevents.length)
          
          for (const vevent of vevents) {
            try {
              const event = this.convertICalEventToCanvasEvent(vevent)
              if (event) {
                events.push(event)
              }
            } catch (error) {
              console.warn('跳过无法解析的事件:', error)
            }
          }
        } catch (error) {
          console.warn('ical.js解析失败，尝试使用备用解析器:', error)
          events = this.parseWithFallbackParser(icalData)
        }
      } else {
        console.log('使用备用解析器解析iCal数据')
        events = this.parseWithFallbackParser(icalData)
      }
      
      console.log('成功解析的事件数量:', events.length)
      return events
      
    } catch (error) {
      console.error('解析iCal文件内容失败:', error)
      throw new Error(`解析Canvas日历文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 使用备用解析器解析iCal数据
   */
  private parseWithFallbackParser(icalData: string): CanvasEvent[] {
    try {
      const simpleEvents = parseICalSimple(icalData)
      const events: CanvasEvent[] = []
      
      for (const simpleEvent of simpleEvents) {
        try {
          const event = this.convertSimpleEventToCanvasEvent(simpleEvent)
          if (event) {
            events.push(event)
          }
        } catch (error) {
          console.warn('跳过无法转换的简单事件:', error)
        }
      }
      
      return events
    } catch (error) {
      console.error('备用解析器也失败了:', error)
      throw new Error('无法解析iCal数据，请检查数据格式是否正确')
    }
  }

  /**
   * 将简单事件转换为Canvas事件
   */
  private convertSimpleEventToCanvasEvent(simpleEvent: SimpleICalEvent): CanvasEvent | null {
    try {
      const uid = simpleEvent.uid
      const title = simpleEvent.summary
      const description = simpleEvent.description || ''
      const location = simpleEvent.location || ''
      const url = simpleEvent.url || ''
      
      if (!title) {
        return null
      }
      
      // 解析开始和结束时间
      const startDate = parseICalDateTime(simpleEvent.dtstart || '')
      const endDate = parseICalDateTime(simpleEvent.dtend || '')
      
      if (!startDate) {
        return null
      }
      
      // 智能识别事件类型
      const type = this.detectEventType(title, description)
      
      // 提取课程名称
      const courseName = this.extractCourseName(title, description)
      
      // 确定优先级
      const priority = this.determinePriority(type, title, description)
      
      return {
        uid,
        title,
        description: description || undefined,
        startDate,
        endDate: endDate || undefined,
        location: location || undefined,
        url: url || undefined,
        type,
        courseName,
        priority
      }
      
    } catch (error) {
      console.warn('转换简单事件失败:', error)
      return null
    }
  }

  /**
   * 将iCal事件转换为Canvas事件
   */
  private convertICalEventToCanvasEvent(vevent: any): CanvasEvent | null {
    try {
      const uid = vevent.getFirstPropertyValue('uid') || ''
      const summary = vevent.getFirstPropertyValue('summary') || ''
      const description = vevent.getFirstPropertyValue('description') || ''
      const location = vevent.getFirstPropertyValue('location') || ''
      const url = vevent.getFirstPropertyValue('url') || ''
      
      // 获取开始和结束时间
      const dtstart = vevent.getFirstPropertyValue('dtstart')
      const dtend = vevent.getFirstPropertyValue('dtend')
      
      if (!dtstart || !summary) {
        return null
      }
      
      const startDate = dtstart.toJSDate()
      const endDate = dtend ? dtend.toJSDate() : null
      
      // 智能识别事件类型
      const type = this.detectEventType(summary, description)
      
      // 提取课程名称
      const courseName = this.extractCourseName(summary, description)
      
      // 确定优先级
      const priority = this.determinePriority(type, summary, description)
      
      return {
        uid,
        title: summary,
        description: description || undefined,
        startDate,
        endDate: endDate || undefined,
        location: location || undefined,
        url: url || undefined,
        type,
        courseName,
        priority
      }
      
    } catch (error) {
      console.warn('转换事件失败:', error)
      return null
    }
  }

  /**
   * 智能识别事件类型
   */
  private detectEventType(title: string, description: string): 'assignment' | 'exam' | 'event' {
    const text = (title + ' ' + description).toLowerCase()
    
    // 作业关键词
    const assignmentKeywords = [
      'assignment', 'homework', 'due', '作业', '练习', '任务', 
      'quiz', '测验', 'project', '项目', 'essay', '论文'
    ]
    
    // 考试关键词
    const examKeywords = [
      'exam', 'test', 'midterm', 'final', '考试', '期中', '期末',
      'quiz', '测试', 'assessment', '评估'
    ]
    
    // 检查是否是作业
    if (assignmentKeywords.some(keyword => text.includes(keyword))) {
      return 'assignment'
    }
    
    // 检查是否是考试
    if (examKeywords.some(keyword => text.includes(keyword))) {
      return 'exam'
    }
    
    return 'event'
  }

  /**
   * 提取课程名称
   */
  private extractCourseName(title: string, description: string): string | undefined {
    // 尝试从标题中提取课程代码或名称
    // 通常Canvas事件的标题格式为: "课程名称: 事件名称" 或 "COURSE123: Event Name"
    const titleMatch = title.match(/^([^:：]+)[:：]\s*(.+)/)
    if (titleMatch) {
      return titleMatch[1].trim()
    }
    
    // 尝试从描述中提取
    const descMatch = description.match(/课程[:：]\s*([^\n\r]+)/)
    if (descMatch) {
      return descMatch[1].trim()
    }
    
    return undefined
  }

  /**
   * 根据事件类型和内容确定优先级
   */
  private determinePriority(type: 'assignment' | 'exam' | 'event', title: string, description: string): 'high' | 'medium' | 'low' {
    // 考试通常是高优先级
    if (type === 'exam') {
      return 'high'
    }
    
    // 作业根据关键词确定优先级
    if (type === 'assignment') {
      const text = (title + ' ' + description).toLowerCase()
      
      // 高优先级关键词
      const highPriorityKeywords = ['final', 'project', 'essay', '期末', '项目', '论文', 'presentation']
      if (highPriorityKeywords.some(keyword => text.includes(keyword))) {
        return 'high'
      }
      
      return 'medium'
    }
    
    // 其他事件默认低优先级
    return 'low'
  }

  /**
   * 将Canvas事件转换为任务格式
   */
  convertEventsToTasks(events: CanvasEvent[]): Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] {
    return events.map(event => {
      // 使用结束时间作为截止时间，如果没有结束时间则使用开始时间
      const deadlineDate = event.endDate || event.startDate
      
      // 构建任务描述
      let description = ''
      if (event.description) {
        description += event.description
      }
      if (event.courseName) {
        description += description ? `\n\n课程: ${event.courseName}` : `课程: ${event.courseName}`
      }
      if (event.location) {
        description += description ? `\n地点: ${event.location}` : `地点: ${event.location}`
      }
      if (event.url) {
        description += description ? `\n链接: ${event.url}` : `链接: ${event.url}`
      }
      
      return {
        title: event.title,
        description: description || undefined,
        deadline_datetime: deadlineDate.toISOString(),
        priority: event.priority || 'medium',
        completed: false
      }
    })
  }

  /**
   * 验证iCal URL格式
   */
  validateICalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      // 检查是否是有效的URL且可能是iCal格式
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * 检测重复任务
   */
  detectDuplicateTasks(
    newTasks: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[],
    existingTasks: Task[]
  ): {
    unique: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]
    duplicates: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]
  } {
    const unique: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = []
    const duplicates: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = []
    
    for (const newTask of newTasks) {
      const isDuplicate = existingTasks.some(existingTask => {
        // 检查标题相似度和截止时间
        const titleSimilar = this.calculateStringSimilarity(
          newTask.title.toLowerCase(),
          existingTask.title.toLowerCase()
        ) > 0.8
        
        const dateSimilar = newTask.deadline_datetime && existingTask.deadline_datetime &&
          Math.abs(new Date(newTask.deadline_datetime).getTime() - new Date(existingTask.deadline_datetime).getTime()) < 24 * 60 * 60 * 1000 // 1天内
        
        return titleSimilar && dateSimilar
      })
      
      if (isDuplicate) {
        duplicates.push(newTask)
      } else {
        unique.push(newTask)
      }
    }
    
    return { unique, duplicates }
  }

  /**
   * 计算字符串相似度 (简单的Levenshtein距离)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    const matrix: number[][] = []
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    const distance = matrix[len1][len2]
    const maxLength = Math.max(len1, len2)
    return maxLength === 0 ? 1 : 1 - distance / maxLength
  }
}

// 导出单例实例
export const canvasImportService = new CanvasImportService()
export default canvasImportService
