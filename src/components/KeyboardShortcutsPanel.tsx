'use client'

interface KeyboardShortcutsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null

  const shortcuts = [
    {
      category: 'Markdown 快捷键',
      items: [
        { keys: ['[', ']', 'Space'], description: '创建待办事项' },
        { keys: ['#', 'Space'], description: '创建一级标题' },
        { keys: ['#', '#', 'Space'], description: '创建二级标题' },
        { keys: ['#', '#', '#', 'Space'], description: '创建三级标题' },
        { keys: ['-', 'Space'], description: '创建无序列表' },
        { keys: ['1', '.', 'Space'], description: '创建有序列表' },
      ]
    },
    {
      category: '文本格式',
      items: [
        { keys: ['Ctrl/Cmd', 'B'], description: '加粗文本' },
        { keys: ['Ctrl/Cmd', 'I'], description: '斜体文本' },
        { keys: ['Ctrl/Cmd', 'U'], description: '下划线' },
        { keys: ['Ctrl/Cmd', 'Shift', 'X'], description: '删除线' },
      ]
    },
    {
      category: '编辑操作',
      items: [
        { keys: ['Ctrl/Cmd', 'Z'], description: '撤销' },
        { keys: ['Ctrl/Cmd', 'Shift', 'Z'], description: '重做' },
        { keys: ['Ctrl/Cmd', 'A'], description: '全选' },
        { keys: ['Ctrl/Cmd', 'S'], description: '保存（自动保存已启用）' },
      ]
    },
    {
      category: '其他',
      items: [
        { keys: ['?'], description: '显示/隐藏此帮助面板' },
        { keys: ['Esc'], description: '关闭此面板' },
      ]
    }
  ]

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* 面板 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题 */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">⌨️ 键盘快捷键</h2>
              <p className="text-sm text-gray-500 mt-1">快速掌握笔记编辑技巧</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              title="关闭 (Esc)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容 */}
          <div className="px-6 py-4 space-y-6">
            {shortcuts.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded"></span>
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, itemIdx) => (
                    <div 
                      key={itemIdx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm">
                              {key}
                            </kbd>
                            {keyIdx < item.keys.length - 1 && (
                              <span className="text-gray-400 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3">
            <p className="text-xs text-gray-500 text-center">
              💡 提示：笔记会自动保存，无需手动保存
            </p>
          </div>
        </div>
      </div>
    </>
  )
}









