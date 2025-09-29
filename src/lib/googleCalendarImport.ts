'use client'

import { googleAuthService, type GoogleUser } from './googleAuth'
import type { Task } from '@/types'

// Google Calendar相关类型定义
interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  backgroundColor?: string
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  status?: 'confirmed' | 'tentative' | 'cancelled'
  attendees?: Array<{
    email: string
    responseStatus: string
  }>
  creator?: {
    email: string
    displayName?: string
  }
  location?: string
  htmlLink?: string
}

interface ImportFilter {
  calendarIds: string[]
  timeMin: string // ISO 8601 格式
  timeMax: string // ISO 8601 格式
  includeAllDayEvents: boolean
  includeDeclinedEvents: boolean
}

class GoogleCalendarImportService {
  private gapi: any = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.gapi = window.gapi
    }
  }

  // 获取用户的所有日历
  public async getCalendars(): Promise<GoogleCalendar[]> {
    if (!googleAuthService.isSignedIn()) {
      throw new Error('用户未登录Google账户')
    }

    try {
      const response = await this.gapi.client.calendar.calendarList.list({
        maxResults: 50,
        showHidden: false
      })

      const calendars: GoogleCalendar[] = response.result.items?.map((item: any) => ({
        id: item.id,
        summary: item.summary,
        description: item.description,
        primary: item.primary || false,
        backgroundColor: item.backgroundColor
      })) || []

      return calendars.sort((a, b) => {
        // 主日历排在前面
        if (a.primary && !b.primary) return -1
        if (!a.primary && b.primary) return 1
        return a.summary.localeCompare(b.summary)
      })
    } catch (error) {
      console.error('获取日历列表失败:', error)
      throw new Error('获取日历列表失败，请检查网络连接和权限')
    }
  }

  // 获取指定日历的事件
  public async getCalendarEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults: number = 100
  ): Promise<GoogleCalendarEvent[]> {
    if (!googleAuthService.isSignedIn()) {
      throw new Error('用户未登录Google账户')
    }

    try {
      const response = await this.gapi.client.calendar.events.list({
        calendarId: calendarId,
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      })

      return response.result.items || []
    } catch (error) {
      console.error(`获取日历 ${calendarId} 的事件失败:`, error)
      throw new Error(`获取日历事件失败: ${error}`)
    }
  }

  // 根据过滤条件获取多个日历的事件
  public async getFilteredEvents(filter: ImportFilter): Promise<GoogleCalendarEvent[]> {
    const allEvents: GoogleCalendarEvent[] = []

    for (const calendarId of filter.calendarIds) {
      try {
        const events = await this.getCalendarEvents(
          calendarId,
          filter.timeMin,
          filter.timeMax,
          250 // 每个日历最多获取250个事件
        )

        // 应用过滤条件
        const filteredEvents = events.filter(event => {
          // 跳过已取消的事件（除非用户要求包含）
          if (event.status === 'cancelled' && !filter.includeDeclinedEvents) {
            return false
          }

          // 跳过全天事件（除非用户要求包含）
          const isAllDay = event.start?.date && !event.start?.dateTime
          if (isAllDay && !filter.includeAllDayEvents) {
            return false
          }

          return true
        })

        allEvents.push(...filteredEvents)
      } catch (error) {
        console.warn(`跳过日历 ${calendarId}:`, error)
      }
    }

    // 按开始时间排序
    return allEvents.sort((a, b) => {
      const timeA = a.start?.dateTime || a.start?.date || ''
      const timeB = b.start?.dateTime || b.start?.date || ''
      return timeA.localeCompare(timeB)
    })
  }

  // 将Google Calendar事件转换为任务
  public convertEventsToTasks(events: GoogleCalendarEvent[]): Task[] {
    return events.map((event, index) => {
      // 确定任务标题
      const title = event.summary || '无标题事件'

      // 构建任务描述
      let description = event.description || ''
      if (event.location) {
        description += description ? `\n\n地点: ${event.location}` : `地点: ${event.location}`
      }
      if (event.htmlLink) {
        description += description ? `\n\n日历链接: ${event.htmlLink}` : `日历链接: ${event.htmlLink}`
      }

      // 确定截止时间
      let deadlineTime: string | undefined
      if (event.start?.dateTime) {
        const startTime = new Date(event.start.dateTime)
        deadlineTime = startTime.toTimeString().slice(0, 5) // HH:MM格式
      } else if (event.start?.date) {
        // 全天事件设为当天23:59
        deadlineTime = '23:59'
      }

      // 智能判断优先级
      let priority: 'high' | 'medium' | 'low' = 'medium'
      const titleLower = title.toLowerCase()
      const descLower = (description || '').toLowerCase()
      
      // 高优先级关键词
      if (titleLower.includes('重要') || titleLower.includes('紧急') || 
          titleLower.includes('urgent') || titleLower.includes('important') ||
          descLower.includes('重要') || descLower.includes('紧急')) {
        priority = 'high'
      }
      // 低优先级关键词
      else if (titleLower.includes('休息') || titleLower.includes('娱乐') ||
               titleLower.includes('personal') || titleLower.includes('休闲')) {
        priority = 'low'
      }
      // 工作时间的事件默认为中等优先级
      else if (event.start?.dateTime) {
        const startTime = new Date(event.start.dateTime)
        const hour = startTime.getHours()
        if (hour >= 9 && hour <= 17) { // 工作时间
          priority = 'medium'
        } else {
          priority = 'low'
        }
      }

      return {
        id: `google-import-${event.id}-${index}`, // 临时ID
        title,
        description: description || undefined,
        deadline_time: deadlineTime,
        priority,
        completed: event.status === 'cancelled', // 已取消的事件标记为完成
        user_id: '', // 将在导入时填入
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
  }

  // 检测重复任务
  public detectDuplicateTasks(newTasks: Task[], existingTasks: Task[]): Task[] {
    return newTasks.filter(newTask => {
      // 检查标题完全匹配
      const titleMatch = existingTasks.some(existing => 
        existing.title.toLowerCase().trim() === newTask.title.toLowerCase().trim()
      )

      if (titleMatch) {
        console.log(`跳过重复任务: ${newTask.title}`)
        return false
      }

      // 检查描述相似性（简单的包含检查）
      if (newTask.description) {
        const descriptionMatch = existingTasks.some(existing => 
          existing.description && 
          existing.description.toLowerCase().includes(newTask.description!.toLowerCase().slice(0, 50))
        )
        
        if (descriptionMatch) {
          console.log(`跳过相似任务: ${newTask.title}`)
          return false
        }
      }

      return true
    })
  }

  // 生成默认的时间过滤器（最近7天）
  public getDefaultFilter(calendarIds: string[]): ImportFilter {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return {
      calendarIds,
      timeMin: sevenDaysAgo.toISOString(),
      timeMax: sevenDaysLater.toISOString(),
      includeAllDayEvents: true,
      includeDeclinedEvents: false
    }
  }

  // 获取预设的时间范围选项
  public getTimeRangeOptions() {
    const now = new Date()
    
    return [
      {
        label: '过去3天',
        timeMin: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: now.toISOString()
      },
      {
        label: '过去7天',
        timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: now.toISOString()
      },
      {
        label: '未来7天',
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        label: '过去和未来7天',
        timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        label: '本月',
        timeMin: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        timeMax: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      }
    ]
  }
}

// 导出单例实例
export const googleCalendarImportService = new GoogleCalendarImportService()
export type { GoogleCalendar, GoogleCalendarEvent, ImportFilter }





