'use client'

import { useState, useEffect } from 'react'
import type { UserProfile, UserProfileInput } from '@/types'
import { ALL_GRADES, CHALLENGE_TAGS, WORKPLACE_TAGS } from '@/types'
import TagSelector from './TagSelector'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  initialProfile?: UserProfile | null
  onSave: (profileData: UserProfileInput) => Promise<void>
}

export default function UserProfileModal({
  isOpen,
  onClose,
  userId,
  initialProfile,
  onSave,
}: UserProfileModalProps) {
  // 表单状态
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [challenges, setChallenges] = useState<string[]>([])
  const [workplaces, setWorkplaces] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // 初始化表单数据
  useEffect(() => {
    if (initialProfile) {
      setMajor(initialProfile.major || '')
      setGrade(initialProfile.grade || '')
      setChallenges(initialProfile.challenges || [])
      setWorkplaces(initialProfile.workplaces || [])
    } else {
      setMajor('')
      setGrade('')
      setChallenges([])
      setWorkplaces([])
    }
    setError('')
  }, [initialProfile, isOpen])

  // 处理保存
  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError('')

      // 准备要保存的数据
      const profileData: UserProfileInput = {
        major: major.trim() || undefined,
        grade: grade || undefined,
        challenges: challenges,
        workplaces: workplaces,
      }

      await onSave(profileData)
      
      // 保存成功后立即关闭弹窗
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // 处理取消
  const handleCancel = () => {
    setError('')
    onClose()
  }

  // 如果弹窗未打开,不渲染
  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={handleCancel}
      />

      {/* 弹窗主体 */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">个人资料设置</h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区域 */}
          <div className="px-6 py-6 space-y-6">
            {/* 错误提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 专业输入框 */}
            <div>
              <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-2">
                专业
              </label>
              <input
                id="major"
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="例如: 计算机科学、心理学、物理学"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                disabled={isSaving}
              />
              <p className="mt-1 text-xs text-gray-500">请输入你的专业方向</p>
            </div>

            {/* 年级下拉选择 */}
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                年级
              </label>
              <select
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-gray-900"
                disabled={isSaving}
              >
                <option value="" className="text-gray-400">请选择年级</option>
                
                {/* 本科 */}
                <optgroup label="Undergraduate">
                  <option value="Freshman">Freshman</option>
                  <option value="Sophomore">Sophomore</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                </optgroup>

                {/* Master's */}
                <optgroup label="Master's">
                  <option value="Master 1st Year">Master 1st Year</option>
                  <option value="Master 2nd Year">Master 2nd Year</option>
                  <option value="Master 3rd Year">Master 3rd Year</option>
                </optgroup>

                {/* Ph.D. */}
                <optgroup label="Ph.D.">
                  <option value="Ph.D. 1st Year">Ph.D. 1st Year</option>
                  <option value="Ph.D. 2nd Year">Ph.D. 2nd Year</option>
                  <option value="Ph.D. 3rd Year">Ph.D. 3rd Year</option>
                  <option value="Ph.D. 4th Year">Ph.D. 4th Year</option>
                  <option value="Ph.D. 5th Year">Ph.D. 5th Year</option>
                </optgroup>
              </select>
              <p className="mt-1 text-xs text-gray-500">选择你当前的年级</p>
            </div>

            {/* 挑战标签选择器 */}
            <TagSelector
              label="My Challenges"
              predefinedTags={CHALLENGE_TAGS}
              selectedTags={challenges}
              onTagsChange={setChallenges}
              maxTags={5}
              placeholder="Enter other challenges"
            />

            {/* 工作场所标签选择器 */}
            <TagSelector
              label="Usual Workplaces"
              predefinedTags={WORKPLACE_TAGS}
              selectedTags={workplaces}
              onTagsChange={setWorkplaces}
              maxTags={5}
              placeholder="Enter other places"
            />

            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">个性化功能</p>
                  <p>完善个人资料后，AI 可以根据你的专业、年级、挑战和工作场所提供更精准的任务建议。</p>
                </div>
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  保存中...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

