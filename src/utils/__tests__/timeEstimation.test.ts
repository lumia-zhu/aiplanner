/**
 * 时间估计工具函数测试
 */

import {
  parseTimeEstimate,
  formatMinutes,
  formatMinutesShort,
  hasBufferTag,
  calculateBuffer,
  addBuffer,
  encodeEstimatedDuration,
  decodeEstimatedDuration,
  formatEncodedDuration,
  validateTimeEstimate,
  getQuickTimeOptions,
  sumDurations
} from '../timeEstimation'

describe('parseTimeEstimate', () => {
  test('解析纯数字', () => {
    expect(parseTimeEstimate('120')).toBe(120)
    expect(parseTimeEstimate('30')).toBe(30)
  })
  
  test('解析小时格式', () => {
    expect(parseTimeEstimate('2小时')).toBe(120)
    expect(parseTimeEstimate('2h')).toBe(120)
    expect(parseTimeEstimate('2 hour')).toBe(120)
    expect(parseTimeEstimate('2hours')).toBe(120)
  })
  
  test('解析分钟格式', () => {
    expect(parseTimeEstimate('30分钟')).toBe(30)
    expect(parseTimeEstimate('30分')).toBe(30)
    expect(parseTimeEstimate('30min')).toBe(30)
    expect(parseTimeEstimate('30 minutes')).toBe(30)
  })
  
  test('解析小时+分钟格式', () => {
    expect(parseTimeEstimate('2小时30分钟')).toBe(150)
    expect(parseTimeEstimate('1h30m')).toBe(90)
  })
  
  test('解析小数小时', () => {
    expect(parseTimeEstimate('2.5小时')).toBe(150)
    expect(parseTimeEstimate('1.5h')).toBe(90)
  })
  
  test('忽略buffer标记', () => {
    expect(parseTimeEstimate('2小时 + buffer')).toBe(120)
    expect(parseTimeEstimate('120 + 缓冲')).toBe(120)
  })
  
  test('无法解析返回null', () => {
    expect(parseTimeEstimate('invalid')).toBeNull()
    expect(parseTimeEstimate('30分钟 - 1小时')).toBeNull()
    expect(parseTimeEstimate('')).toBeNull()
  })
})

describe('formatMinutes', () => {
  test('格式化小于60分钟', () => {
    expect(formatMinutes(30)).toBe('30分钟')
    expect(formatMinutes(45)).toBe('45分钟')
  })
  
  test('格式化整小时', () => {
    expect(formatMinutes(60)).toBe('1小时')
    expect(formatMinutes(120)).toBe('2小时')
  })
  
  test('格式化小时+分钟', () => {
    expect(formatMinutes(90)).toBe('1小时30分钟')
    expect(formatMinutes(150)).toBe('2小时30分钟')
  })
  
  test('处理字符串输入', () => {
    expect(formatMinutes('120')).toBe('2小时')
  })
})

describe('encodeEstimatedDuration & decodeEstimatedDuration', () => {
  test('编码不含buffer的时间', () => {
    expect(encodeEstimatedDuration(120, false)).toBe(120)
    expect(encodeEstimatedDuration(60, false)).toBe(60)
  })
  
  test('编码含buffer的时间', () => {
    const encoded = encodeEstimatedDuration(100, true)
    expect(encoded).toBe(10120) // 100 * 1.2 = 120, 10000 + 120
  })
  
  test('解码不含buffer的时间', () => {
    const result = decodeEstimatedDuration(120)
    expect(result.minutes).toBe(120)
    expect(result.hasBuffer).toBe(false)
    expect(result.totalMinutes).toBe(120)
  })
  
  test('解码含buffer的时间', () => {
    const result = decodeEstimatedDuration(10120)
    expect(result.minutes).toBe(100)
    expect(result.hasBuffer).toBe(true)
    expect(result.totalMinutes).toBe(120)
  })
  
  test('往返编码解码一致', () => {
    const original = 100
    const encoded = encodeEstimatedDuration(original, true)
    const decoded = decodeEstimatedDuration(encoded)
    expect(decoded.minutes).toBe(original)
    expect(decoded.hasBuffer).toBe(true)
  })
})

describe('formatEncodedDuration', () => {
  test('格式化不含buffer', () => {
    expect(formatEncodedDuration(120)).toBe('2小时')
    expect(formatEncodedDuration(30)).toBe('30分钟')
  })
  
  test('格式化含buffer', () => {
    expect(formatEncodedDuration(10120)).toBe('2小时 + buffer') // 100分钟
  })
})

describe('validateTimeEstimate', () => {
  test('有效时间', () => {
    expect(validateTimeEstimate(60).valid).toBe(true)
    expect(validateTimeEstimate(120).valid).toBe(true)
  })
  
  test('时间过小', () => {
    const result = validateTimeEstimate(2)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('至少5分钟')
  })
  
  test('时间过大', () => {
    const result = validateTimeEstimate(1500)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('不能超过24小时')
  })
  
  test('负数时间', () => {
    const result = validateTimeEstimate(-10)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('大于0')
  })
})

describe('sumDurations', () => {
  test('计算多个任务总时长', () => {
    const durations = [60, 120, 10120] // 1h + 2h + (100m + buffer)
    const total = sumDurations(durations)
    expect(total).toBe(60 + 120 + 120) // 300分钟
  })
  
  test('处理undefined', () => {
    const durations = [60, undefined, 120]
    const total = sumDurations(durations)
    expect(total).toBe(180)
  })
})







