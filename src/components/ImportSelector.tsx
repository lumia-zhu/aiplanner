'use client'

import React from 'react'

interface ImportOption {
  id: 'outlook' | 'google'
  name: string
  icon: React.ReactNode
  description: string
  available: boolean
}

interface ImportSelectorProps {
  onSelectPlatform: (platform: 'outlook' | 'google') => void
  onClose: () => void
}

export default function ImportSelector({ onSelectPlatform, onClose }: ImportSelectorProps) {
  const importOptions: ImportOption[] = [
    {
      id: 'outlook',
      name: 'Outlook 任务',
      icon: (
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      ),
      description: '从 Microsoft Outlook 导入你的任务',
      available: true
    },
    {
      id: 'google',
      name: 'Google Calendar',
      icon: (
        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
          </svg>
        </div>
      ),
      description: '从 Google Calendar 导入你的日程作为任务',
      available: true // Google Calendar导入已完成开发
    }
  ]

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">导入任务</h2>
            <p className="text-sm text-gray-500 mt-1">选择要导入任务的平台</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 平台选择 */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {importOptions.map((option) => (
              <div
                key={option.id}
                className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                  option.available
                    ? 'border-gray-200 hover:border-blue-400 hover:shadow-lg hover:scale-105 active:scale-100'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                }`}
                onClick={() => option.available && onSelectPlatform(option.id)}
              >
                {/* 不可用标记 */}
                {!option.available && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-gray-400 text-white text-xs px-2 py-1 rounded-full">
                      即将推出
                    </span>
                  </div>
                )}

                <div className="flex items-start space-x-4">
                  {option.icon}
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {option.name}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </div>

                {/* 可用时的箭头指示 */}
                {option.available && (
                  <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 使用说明 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">使用说明</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 选择平台后需要授权访问你的账户</li>
                  <li>• 你可以预览要导入的任务并选择性添加</li>
                  <li>• 重复的任务会被自动跳过</li>
                  <li>• 导入的任务会保留原有的优先级和时间信息</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
