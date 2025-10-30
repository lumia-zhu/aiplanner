'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Extension, InputRule, Node } from '@tiptap/core'
import { mergeAttributes } from '@tiptap/core'
import { TaskTag } from '@/components/extensions/TaskTag'
import TagDropdown from '@/components/TagDropdown'
import type { PresetTag } from '@/constants/tags'

// 自定义 TaskItem 支持拖拽
const DraggableTaskItem = TaskItem.extend({
  draggable: true,
  
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-drag-handle': {
        default: null,
        parseHTML: element => element.getAttribute('data-drag-handle'),
        renderHTML: attributes => {
          return {
            'data-drag-handle': '',
          }
        },
      },
    }
  },
})

const TaskListMarkdown = Extension.create({
  name: 'taskListMarkdown',
  addInputRules() {
    return [
      new InputRule({
        find: /^(\s*)\[\]\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleTaskList()
        }
      }),
      new InputRule({
        find: /^(\s*)([-+*])\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleBulletList()
        }
      }),
      new InputRule({
        find: /^(\s*)(\d+)\.\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleOrderedList()
        }
      }),
      new InputRule({
        find: /^(\s*)#\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 1 })
        }
      }),
      new InputRule({
        find: /^(\s*)##\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 2 })
        }
      }),
      new InputRule({
        find: /^(\s*)###\s$/,
        handler: ({ range, commands }) => {
          commands.deleteRange({ from: range.from, to: range.to })
          return commands.toggleHeading({ level: 3 })
        }
      }),
    ]
  }
})

interface NoteEditorProps {
  initialContent?: JSONContent
  onSave?: (content: JSONContent) => void
  onUpdate?: (content: JSONContent) => void  // 新增：实时更新回调
  placeholder?: string
  editable?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
}

export default function NoteEditor({
  initialContent,
  onSave,
  onUpdate,
  placeholder = '开始记录你的想法... 输入 [] 创建待办，# 创建标题',
  editable = true,
  autoSave = true,
  autoSaveDelay = 1000
}: NoteEditorProps) {
  
  const [showBubbleMenu, setShowBubbleMenu] = useState(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState({ top: 0, left: 0 })
  
  // 标签下拉菜单状态
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagDropdownPosition, setTagDropdownPosition] = useState({ x: 0, y: 0 })
  const [currentTaskElement, setCurrentTaskElement] = useState<HTMLElement | null>(null)
  const [selectedTags, setSelectedTags] = useState<PresetTag[]>([])
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TaskList,
      DraggableTaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item-with-drag-handle',
        },
      }),
      Placeholder.configure({
        placeholder
      }),
      TaskTag,
      TaskListMarkdown,
    ],
    content: initialContent || {
      type: 'doc',
      content: [
        { type: 'paragraph' }
      ]
    },
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3'
      },
      handleKeyDown: (view, event) => {
        // 处理 Tab 键缩进
        if (event.key === 'Tab') {
          event.preventDefault()
          
          if (event.shiftKey) {
            // Shift+Tab: 减少缩进
            return editor?.commands.liftListItem('taskItem') || 
                   editor?.commands.liftListItem('listItem') || 
                   false
          } else {
            // Tab: 增加缩进
            return editor?.commands.sinkListItem('taskItem') || 
                   editor?.commands.sinkListItem('listItem') || 
                   false
          }
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON()
      
      // 实时更新回调（不防抖）
      onUpdate?.(content)
      
      // 自动保存（防抖）
      if (autoSave && onSave) {
        debouncedSave(content)
      }
    },
  })

  // 防抖保存函数
  const debouncedSave = useCallback(
    debounce((content: JSONContent) => {
      console.log('📝 NoteEditor: 触发自动保存', content)
      onSave?.(content)
    }, autoSaveDelay),
    [onSave, autoSaveDelay]
  )

  // 当 initialContent 改变时更新编辑器
  useEffect(() => {
    if (editor && initialContent) {
      const currentContent = editor.getJSON()
      if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent)
      }
    }
  }, [editor, initialContent])

  // 监听文本选择，显示浮动菜单
  useEffect(() => {
    if (!editor) return

    const updateBubbleMenu = () => {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (hasSelection && editable) {
        // 获取选中文本的位置
        const { view } = editor
        const start = view.coordsAtPos(from)
        const end = view.coordsAtPos(to)
        
        // 计算菜单位置（选中文本上方居中）
        const left = (start.left + end.left) / 2
        const top = start.top - 50 // 菜单高度约 40px，留 10px 间距
        
        setBubbleMenuPosition({ top, left })
        setShowBubbleMenu(true)
      } else {
        setShowBubbleMenu(false)
      }
    }

    editor.on('selectionUpdate', updateBubbleMenu)
    editor.on('update', updateBubbleMenu)

    return () => {
      editor.off('selectionUpdate', updateBubbleMenu)
      editor.off('update', updateBubbleMenu)
    }
  }, [editor, editable])

  // 添加拖拽动画效果
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom
    let draggedElement: HTMLElement | null = null
    let dragImage: HTMLElement | null = null

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const taskItem = target.closest('li[data-type="taskItem"]')
      
      if (taskItem) {
        draggedElement = taskItem as HTMLElement
        
        // 添加拖拽样式
        draggedElement.classList.add('dragging')
        
        // 创建自定义拖拽预览
        dragImage = draggedElement.cloneNode(true) as HTMLElement
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-9999px'
        dragImage.style.left = '-9999px'
        dragImage.style.width = draggedElement.offsetWidth + 'px'
        dragImage.style.opacity = '0.8'
        dragImage.style.transform = 'rotate(2deg)'
        dragImage.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)'
        dragImage.style.borderRadius = '0.375rem'
        dragImage.style.backgroundColor = '#ffffff'
        dragImage.style.padding = '0.5rem'
        document.body.appendChild(dragImage)
        
        // 设置拖拽图像
        e.dataTransfer!.effectAllowed = 'move'
        e.dataTransfer!.setDragImage(dragImage, 0, 0)
        
        // 添加拖拽开始动画
        requestAnimationFrame(() => {
          if (draggedElement) {
            draggedElement.style.transition = 'all 0.2s ease'
          }
        })
      }
    }

    const handleDragEnd = (e: DragEvent) => {
      if (draggedElement) {
        // 移除拖拽样式
        draggedElement.classList.remove('dragging')
        draggedElement.style.transition = ''
        draggedElement = null
      }
      
      // 清理拖拽预览
      if (dragImage && document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
        dragImage = null
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
    }

    // 添加拖拽进入效果
    const handleDragEnter = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const taskItem = target.closest('li[data-type="taskItem"]')
      
      if (taskItem && taskItem !== draggedElement) {
        taskItem.classList.add('drag-over')
      }
    }

    // 添加拖拽离开效果
    const handleDragLeave = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const taskItem = target.closest('li[data-type="taskItem"]')
      
      if (taskItem) {
        taskItem.classList.remove('drag-over')
      }
    }

    editorElement.addEventListener('dragstart', handleDragStart)
    editorElement.addEventListener('dragend', handleDragEnd)
    editorElement.addEventListener('dragover', handleDragOver)
    editorElement.addEventListener('dragenter', handleDragEnter)
    editorElement.addEventListener('dragleave', handleDragLeave)

    return () => {
      editorElement.removeEventListener('dragstart', handleDragStart)
      editorElement.removeEventListener('dragend', handleDragEnd)
      editorElement.removeEventListener('dragover', handleDragOver)
      editorElement.removeEventListener('dragenter', handleDragEnter)
      editorElement.removeEventListener('dragleave', handleDragLeave)
      
      // 清理可能残留的拖拽预览
      if (dragImage && document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }
  }, [editor])

  // 处理拖拽手柄左键点击，显示标签菜单
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) {
        return
      }

      const target = e.target as HTMLElement
      
      // 检查是否点击了任务项的拖拽手柄区域
      const taskItem = target.closest('li[data-drag-handle]') as HTMLElement | null
      
      if (taskItem) {
        const rect = taskItem.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        
        // 如果点击在左侧 30px 区域（拖拽手柄区域）
        if (clickX >= 0 && clickX < 30) {
          e.preventDefault()
          e.stopPropagation()
          
          // 设置下拉菜单位置（在手柄右侧显示）
          setTagDropdownPosition({
            x: rect.left + 35,
            y: rect.top
          })
          
          // 保存当前任务元素
          setCurrentTaskElement(taskItem)
          
          // TODO: 提取当前任务的已有标签
          setSelectedTags([])
          
          // 显示下拉菜单
          setShowTagDropdown(true)
        }
      }
    }

    editorElement.addEventListener('mousedown', handleMouseDown, true)

    return () => {
      editorElement.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [editor])

  // 处理标签选择
  const handleSelectTag = useCallback((tag: PresetTag) => {
    if (!editor || !currentTaskElement) return
    
    // 添加标签到选中列表
    setSelectedTags(prev => [...prev, tag])
    
    // 将标签应用到任务文本末尾
    try {
      // 找到当前任务在编辑器中的位置
      const pos = editor.view.posAtDOM(currentTaskElement, 0)
      
      // 获取任务节点
      const resolvedPos = editor.state.doc.resolve(pos)
      const taskNode = resolvedPos.parent
      
      if (taskNode && taskNode.type.name === 'taskItem') {
        // 在任务文本末尾插入标签
        const endPos = pos + taskNode.nodeSize - 1
        
        editor
          .chain()
          .focus()
          .setTextSelection(endPos)
          .insertContent([
            {
              type: 'text',
              text: ' ',
              marks: [
                {
                  type: 'taskTag',
                  attrs: {
                    label: tag.label,
                    emoji: tag.emoji,
                    color: tag.color,
                  },
                },
              ],
            },
          ])
          .run()
        
        console.log('✅ 标签已添加:', tag)
      }
    } catch (error) {
      console.error('❌ 添加标签失败:', error)
    }
  }, [editor, currentTaskElement])

  // 处理标签移除
  const handleRemoveTag = useCallback((tag: PresetTag) => {
    if (!editor || !currentTaskElement) return
    
    // 从选中列表移除标签
    setSelectedTags(prev => prev.filter(t => t.label !== tag.label))
    
    // 从任务文本中移除标签
    try {
      const pos = editor.view.posAtDOM(currentTaskElement, 0)
      const resolvedPos = editor.state.doc.resolve(pos)
      const taskNode = resolvedPos.parent
      
      if (taskNode && taskNode.type.name === 'taskItem') {
        // 遍历任务节点的内容，找到并删除匹配的标签
        let found = false
        taskNode.descendants((node, pos) => {
          if (found) return false
          
          if (node.marks) {
            node.marks.forEach(mark => {
              if (mark.type.name === 'taskTag' && mark.attrs.label === tag.label) {
                const absolutePos = resolvedPos.pos + pos + 1
                editor
                  .chain()
                  .focus()
                  .setTextSelection({ from: absolutePos, to: absolutePos + node.nodeSize })
                  .deleteSelection()
                  .run()
                
                found = true
                console.log('✅ 标签已移除:', tag)
              }
            })
          }
        })
      }
    } catch (error) {
      console.error('❌ 移除标签失败:', error)
    }
  }, [editor, currentTaskElement])

  // 关闭标签下拉菜单
  const handleCloseTagDropdown = useCallback(() => {
    setShowTagDropdown(false)
    setCurrentTaskElement(null)
  }, [])

  // 处理点击标签删除
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom

    const handleTagClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const tagElement = target.closest('span[data-task-tag]')
      
      if (tagElement) {
        e.preventDefault()
        e.stopPropagation()
        
        const label = tagElement.getAttribute('data-label')
        
        if (label && confirm(`确定要删除标签"${label}"吗？`)) {
          // 找到标签在文档中的位置并删除
          const pos = editor.view.posAtDOM(tagElement, 0)
          const resolvedPos = editor.state.doc.resolve(pos)
          const node = resolvedPos.parent
          
          if (node) {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: pos, to: pos + node.nodeSize })
              .deleteSelection()
              .run()
            
            console.log('✅ 点击删除标签:', label)
          }
        }
      }
    }

    editorElement.addEventListener('click', handleTagClick, true)

    return () => {
      editorElement.removeEventListener('click', handleTagClick, true)
    }
  }, [editor])

  if (!editor) {
    return <div className="p-4 text-gray-500">加载编辑器...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 编辑器主体 */}
      <EditorContent editor={editor} />

      {/* 浮动工具栏 - 选中文本时显示 */}
      {showBubbleMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 text-gray-700 rounded-lg px-1.5 py-1.5 flex items-center gap-1 animate-bubble-menu"
          style={{
            top: `${bubbleMenuPosition.top}px`,
            left: `${bubbleMenuPosition.left}px`,
            transform: 'translateX(-50%)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* 待办列表 - 移到最左边 */}
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('taskList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="待办列表 ([] + 空格)"
          >
            ☐
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 粗体 */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 font-bold ${
              editor.isActive('bold') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="粗体 (⌘B)"
          >
            B
          </button>

          {/* 斜体 */}
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 italic ${
              editor.isActive('italic') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="斜体 (⌘I)"
          >
            I
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 标题 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 1 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="一级标题 (# + 空格)"
          >
            H1
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="二级标题 (## + 空格)"
          >
            H2
          </button>

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('heading', { level: 3 }) ? 'bg-blue-50 text-blue-600 font-medium shadow-sm' : 'text-gray-700'
            }`}
            title="三级标题 (### + 空格)"
          >
            H3
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5" />

          {/* 列表 */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('bulletList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="无序列表 (- + 空格)"
          >
            •
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-all duration-150 ${
              editor.isActive('orderedList') ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-700'
            }`}
            title="有序列表 (1. + 空格)"
          >
            1.
          </button>
        </div>
      )}

      {/* 标签下拉菜单 */}
      {showTagDropdown && (
        <TagDropdown
          position={tagDropdownPosition}
          selectedTags={selectedTags}
          onSelectTag={handleSelectTag}
          onRemoveTag={handleRemoveTag}
          onClose={handleCloseTagDropdown}
        />
      )}

      {/* 底部提示栏 */}
      {editable && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-500 leading-relaxed">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-medium text-gray-600">💡 Markdown 快捷键:</span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">[]</code> 待办
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">#</code> 标题
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">-</code> 列表
            </span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">1.</code> 有序
            </span>
            <span className="text-gray-400">|</span>
            <span>
              <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">Tab</code> 缩进
            </span>
            {autoSave && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-green-600 font-medium">✓ 自动保存</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 简单的防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}


