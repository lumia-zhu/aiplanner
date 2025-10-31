/**
 * 日期时间相关类型定义
 */

// 时间设置模式
export type DateTimeMode = 'deadline' | 'interval'

// 截止时间（单个时间点）
export interface Deadline {
  mode: 'deadline'
  time: Date  // 截止的日期时间
}

// 时间间隔（时间段）
export interface TimeInterval {
  mode: 'interval'
  startTime: Date  // 开始时间
  endTime: Date    // 结束时间
}

// 日期时间设置（联合类型）
export type DateTimeSetting = Deadline | TimeInterval

// 用于组件内部状态的接口
export interface DateTimeFormData {
  mode: DateTimeMode
  
  // 截止时间模式的字段
  deadlineDate: string  // YYYY-MM-DD 格式
  deadlineTime: string  // HH:mm 格式
  
  // 时间间隔模式的字段
  startDate: string     // YYYY-MM-DD 格式
  startTime: string     // HH:mm 格式
  endDate: string       // YYYY-MM-DD 格式
  endTime: string       // HH:mm 格式
}





