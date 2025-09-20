import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📋 任务管理器
          </h1>
          <p className="text-gray-600">
            简洁高效的任务管理应用
          </p>
        </div>
        
        <div className="space-y-4">
          <Link 
            href="/auth/login"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium block"
          >
            登录 / 注册
          </Link>
          
          <Link 
            href="/env-test"
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium block"
          >
            环境变量诊断
          </Link>
          
              <Link 
                href="/test"
                className="w-full bg-gray-200 text-gray-600 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium block"
              >
                测试数据库连接
              </Link>
              
              <Link 
                href="/debug-db"
                className="w-full bg-yellow-100 text-yellow-800 py-3 px-4 rounded-lg hover:bg-yellow-200 transition-colors font-medium block"
              >
                🔧 数据库调试工具
              </Link>
              
              <Link 
                href="/quick-test"
                className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg hover:bg-green-200 transition-colors font-medium block"
              >
                🚀 快速测试
              </Link>
              
              <Link 
                href="/outlook-debug"
                className="w-full bg-purple-100 text-purple-800 py-3 px-4 rounded-lg hover:bg-purple-200 transition-colors font-medium block"
              >
                🔍 Outlook 诊断
              </Link>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>✨ 功能特色</p>
          <ul className="mt-2 space-y-1">
            <li>• 任务增删改查</li>
            <li>• 优先级管理</li>
            <li>• 截止日期提醒</li>
            <li>• 响应式设计</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
