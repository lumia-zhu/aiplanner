'use client'

import { useEffect, useState } from 'react'

export default function EnvTestPage() {
  const [envVars, setEnvVars] = useState<{
    url?: string
    key?: string
    allEnvKeys: string[]
  }>({ allEnvKeys: [] })

  useEffect(() => {
    // 获取所有以 NEXT_PUBLIC_ 开头的环境变量
    const allEnvKeys = Object.keys(process.env).filter(key => 
      key.startsWith('NEXT_PUBLIC_')
    )
    
    setEnvVars({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      allEnvKeys
    })
    
    // 在控制台输出调试信息
    console.log('🔍 环境变量调试:')
    console.log('- 所有 NEXT_PUBLIC_ 变量:', allEnvKeys)
    console.log('- SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('- SUPABASE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            环境变量诊断
          </h1>
          <p className="text-gray-600">
            检查 Next.js 是否正确加载了环境变量
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Supabase URL:
            </h2>
            <p className="text-sm text-gray-600 break-all bg-gray-100 p-2 rounded">
              {envVars.url || '❌ 未设置'}
            </p>
          </div>
          
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Supabase Key:
            </h2>
            <p className="text-sm text-gray-600 break-all bg-gray-100 p-2 rounded">
              {envVars.key ? `${envVars.key.substring(0, 50)}...` : '❌ 未设置'}
            </p>
          </div>
          
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              所有 NEXT_PUBLIC_ 环境变量:
            </h2>
            <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
              {envVars.allEnvKeys.length > 0 ? (
                <ul className="space-y-1">
                  {envVars.allEnvKeys.map(key => (
                    <li key={key} className="font-mono">
                      {key}: {process.env[key] ? '✅' : '❌'}
                    </li>
                  ))}
                </ul>
              ) : (
                '❌ 没有找到任何 NEXT_PUBLIC_ 环境变量'
              )}
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className={`text-center p-4 rounded ${
              envVars.url && envVars.key 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {envVars.url && envVars.key ? 
                '✅ 环境变量配置正确！' : 
                '❌ 环境变量配置有误'
              }
            </div>
          </div>
          
          <div className="text-xs text-gray-500 space-y-2">
            <p><strong>故障排除步骤：</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>确保 .env.local 文件在项目根目录</li>
              <li>确保环境变量名以 NEXT_PUBLIC_ 开头</li>
              <li>重启开发服务器 (Ctrl+C 然后 npm run dev)</li>
              <li>检查控制台是否有其他错误</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
