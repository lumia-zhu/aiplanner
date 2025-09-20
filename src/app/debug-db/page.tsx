'use client'

import { useState } from 'react'
import { checkTableStructure, testTaskCreation } from '@/lib/check-table-structure'

export default function DebugDBPage() {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const runStructureCheck = async () => {
    setIsLoading(true)
    setResult('正在检查表结构...\n')
    
    try {
      const result = await checkTableStructure()
      
      if (result.success) {
        setResult(prev => prev + '\n✅ 表结构检查通过！\n')
        if (result.details?.columns) {
          setResult(prev => prev + '\n📋 表字段:\n')
          result.details.columns.forEach((col: any) => {
            setResult(prev => prev + `- ${col.column_name}: ${col.data_type}\n`)
          })
        }
      } else {
        setResult(prev => prev + `\n❌ 表结构检查失败: ${result.error}\n`)
        setResult(prev => prev + '\n🔧 建议操作:\n')
        setResult(prev => prev + '1. 在 Supabase SQL Editor 中运行 complete-fix.sql\n')
        setResult(prev => prev + '2. 重新检查表结构\n')
      }
    } catch (error) {
      setResult(prev => prev + `\n❌ 检查异常: ${error}\n`)
    } finally {
      setIsLoading(false)
    }
  }

  const runTaskCreationTest = async () => {
    setIsLoading(true)
    setResult('正在测试任务创建...\n')
    
    try {
      const success = await testTaskCreation()
      
      if (success) {
        setResult(prev => prev + '\n✅ 任务创建测试通过！\n')
      } else {
        setResult(prev => prev + '\n❌ 任务创建测试失败，请查看控制台详细信息。\n')
      }
    } catch (error) {
      setResult(prev => prev + `\n❌ 测试异常: ${error}\n`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            数据库调试工具
          </h1>
          <p className="text-gray-600">
            检查数据库表结构和任务创建功能
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div className="space-y-4">
            <button
              onClick={runStructureCheck}
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? '检查中...' : '检查表结构'}
            </button>
            
            <button
              onClick={runTaskCreationTest}
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isLoading ? '测试中...' : '测试任务创建'}
            </button>
          </div>
          
          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {result}
              </pre>
            </div>
          )}
          
          <div className="mt-6 text-xs text-gray-500 space-y-3">
            <div>
              <p className="font-medium">🔧 如果表结构检查失败：</p>
              <ol className="list-decimal list-inside space-y-1 mt-2 ml-4">
                <li>在 Supabase SQL Editor 中运行 <code>fix-deadline-field.sql</code></li>
                <li>重新检查表结构</li>
                <li>如果仍有问题，请查看浏览器控制台的详细错误信息</li>
              </ol>
            </div>
            
            <div>
              <p className="font-medium">📝 SQL 脚本位置：</p>
              <p className="ml-4 font-mono text-xs bg-gray-200 p-1 rounded">
                task-manager/database/fix-deadline-field.sql
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
