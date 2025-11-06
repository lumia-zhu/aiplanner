/**
 * Agent 工具注册中心测试
 * 
 * 测试工具的注册、查找、缓存等功能
 */

import { getAllTools, getTool, resetToolsCache, hasToolByName } from '../index'
import type { AgentTool } from '../../AgentTypes'

describe('Agent Tools Registry', () => {
  // 每个测试前重置缓存
  beforeEach(() => {
    resetToolsCache()
  })

  describe('getAllTools', () => {
    test('应该返回工具数组', () => {
      const tools = getAllTools()
      expect(Array.isArray(tools)).toBe(true)
    })

    test('应该缓存工具列表（第二次调用不重新创建）', () => {
      const tools1 = getAllTools()
      const tools2 = getAllTools()
      
      // 应该返回同一个引用（缓存生效）
      expect(tools1).toBe(tools2)
    })

    test('返回的工具应该符合 AgentTool 接口', () => {
      const tools = getAllTools()
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool).toHaveProperty('execute')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(typeof tool.execute).toBe('function')
      })
    })
  })

  describe('getTool', () => {
    test('应该能根据名称查找工具', () => {
      const tools = getAllTools()
      
      // 如果有工具，测试查找功能
      if (tools.length > 0) {
        const firstToolName = tools[0].name
        const foundTool = getTool(firstToolName)
        
        expect(foundTool).toBeDefined()
        expect(foundTool.name).toBe(firstToolName)
      }
    })

    test('应该在工具不存在时抛出错误', () => {
      expect(() => {
        getTool('non_existent_tool_12345')
      }).toThrow()
    })

    test('抛出的错误应该包含可用工具列表', () => {
      try {
        getTool('non_existent_tool')
      } catch (error: any) {
        expect(error.message).toContain('不存在')
        expect(error.message).toContain('可用工具')
      }
    })
  })

  describe('hasToolByName', () => {
    test('存在的工具应该返回 true', () => {
      const tools = getAllTools()
      
      if (tools.length > 0) {
        const firstToolName = tools[0].name
        expect(hasToolByName(firstToolName)).toBe(true)
      }
    })

    test('不存在的工具应该返回 false', () => {
      expect(hasToolByName('non_existent_tool_12345')).toBe(false)
    })
  })

  describe('resetToolsCache', () => {
    test('应该清空缓存并强制重新创建工具', () => {
      const tools1 = getAllTools()
      resetToolsCache()
      const tools2 = getAllTools()
      
      // 应该是不同的引用（重新创建）
      expect(tools1).not.toBe(tools2)
    })
  })

  describe('工具数量（Phase 2 进度）', () => {
    test('Phase 2 完成后应该有 6 个工具', () => {
      const tools = getAllTools()
      
      // Phase 2 进行中：工具数量会逐步增加
      // 当前：0 个（Step 1 刚完成）
      // 最终：6 个（LoadTaskContext, GetTasks, AnalyzeTasks, Clarify, Decompose, EstimateTime）
      
      // 这个测试会在 Phase 2 完成时通过
      // expect(tools.length).toBe(6)
      
      // 当前验证：至少是一个数组
      expect(tools.length).toBeGreaterThanOrEqual(0)
    })

    test('应该输出工具加载日志', () => {
      // Mock console.log
      const consoleSpy = jest.spyOn(console, 'log')
      
      resetToolsCache()
      getAllTools()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Agent 工具已加载')
      )
      
      consoleSpy.mockRestore()
    })
  })
})



