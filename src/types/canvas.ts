// Canvas相关的类型定义

export interface CanvasEvent {
  uid: string
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  location?: string
  url?: string
  type: 'assignment' | 'exam' | 'event'
  courseName?: string
  priority?: 'high' | 'medium' | 'low'
}

export interface CanvasImportConfig {
  iCalUrl: string
  timeRange?: {
    start: Date
    end: Date
  }
  includeEventTypes: ('assignment' | 'exam' | 'event')[]
  defaultPriority: 'high' | 'medium' | 'low'
}

export interface CanvasImportResult {
  total: number
  imported: number
  skipped: number
  errors: number
  errorDetails?: string[]
}

export interface CanvasImportStep {
  step: 'url' | 'preview' | 'importing' | 'complete'
  title: string
  description: string
}

// iCal.js 的基础类型定义
declare module 'ical.js' {
  interface ICALComponent {
    name: string
    getAllProperties(): any[]
    getFirstPropertyValue(name: string): any
    getAllSubcomponents(name?: string): ICALComponent[]
  }

  interface ICALTime {
    toJSDate(): Date
  }

  const ICAL: {
    parse(input: string): any[]
    Component: new (jCal: any) => ICALComponent
  }

  export = ICAL
}
