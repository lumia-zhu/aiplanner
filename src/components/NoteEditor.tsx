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
import TaskActionMenu from '@/components/TaskActionMenu'
import DateTimePicker from '@/components/DateTimePicker'
import TaskDurationPicker from '@/components/TaskDurationPicker'
import type { PresetTag } from '@/constants/tags'
import type { DateTimeSetting } from '@/types/datetime'

// ⭐ 自定义上下文信息节点
const ContextInfo = Node.create({
  name: 'contextInfo',
  
  group: 'block',
  
  content: 'text*',
  
  parseHTML() {
    return [
      {
        tag: 'p.context-info',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { class: 'context-info' }), 0]
  },
  
  addKeyboardShortcuts() {
    return {
      // 按Enter键退出上下文信息块
      Enter: () => {
        return this.editor.commands.splitBlock()
      },
    }
  },
})

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
      // 时间设置相关属性
      datetimeMode: {
        default: null,
        parseHTML: element => element.getAttribute('data-datetime-mode'),
        renderHTML: attributes => {
          if (!attributes.datetimeMode) return {}
          return {
            'data-datetime-mode': attributes.datetimeMode,
          }
        },
      },
      deadlineTime: {
        default: null,
        parseHTML: element => element.getAttribute('data-deadline-time'),
        renderHTML: attributes => {
          if (!attributes.deadlineTime) return {}
          return {
            'data-deadline-time': attributes.deadlineTime,
          }
        },
      },
      intervalStart: {
        default: null,
        parseHTML: element => element.getAttribute('data-interval-start'),
        renderHTML: attributes => {
          if (!attributes.intervalStart) return {}
          return {
            'data-interval-start': attributes.intervalStart,
          }
        },
      },
      intervalEnd: {
        default: null,
        parseHTML: element => element.getAttribute('data-interval-end'),
        renderHTML: attributes => {
          if (!attributes.intervalEnd) return {}
          return {
            'data-interval-end': attributes.intervalEnd,
          }
        },
      },
      // ⏳ 新增：预计时长属性
      estimatedDuration: {
        default: null,
        parseHTML: element => {
          const val = element.getAttribute('data-estimated-duration')
          return val ? parseInt(val, 10) : null
        },
        renderHTML: attributes => {
          if (!attributes.estimatedDuration) return {}
          return {
            'data-estimated-duration': attributes.estimatedDuration,
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
  initialContent?: JSONContent | null
  onSave?: (content: JSONContent) => void
  onUpdate?: (content: JSONContent) => void  // 新增：实时更新回调
  onDecompose?: (taskTitle: string) => void  // ⭐ 新增：拆解任务回调（传递任务标题）
  placeholder?: string
  editable?: boolean
  editorRef?: React.MutableRefObject<any>  // ⭐ 新增：暴露 editor 实例
  autoSave?: boolean
  autoSaveDelay?: number
}

export default function NoteEditor({
  initialContent,
  onSave,
  onUpdate,
  onDecompose,
  placeholder = '开始记录你的想法... 输入 [] 创建待办，# 创建标题',
  editable = true,
  editorRef,
  autoSave = true,
  autoSaveDelay = 1000
}: NoteEditorProps) {
  
  const [showBubbleMenu, setShowBubbleMenu] = useState(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState({ top: 0, left: 0 })
  
  // 任务操作菜单状态
  const [showTaskActionMenu, setShowTaskActionMenu] = useState(false)
  const [taskActionMenuPosition, setTaskActionMenuPosition] = useState({ x: 0, y: 0 })
  
  // 标签下拉菜单状态
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagDropdownPosition, setTagDropdownPosition] = useState({ x: 0, y: 0 })
  const [currentTaskElement, setCurrentTaskElement] = useState<HTMLElement | null>(null)
  const [selectedTags, setSelectedTags] = useState<PresetTag[]>([])
  
  // 时间选择器状态
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [dateTimePickerPosition, setDateTimePickerPosition] = useState({ x: 0, y: 0 })

  // ⏳ 时长选择器状态
  const [showDurationPicker, setShowDurationPicker] = useState(false)
  const [durationPickerPosition, setDurationPickerPosition] = useState({ x: 0, y: 0 })
  
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
      ContextInfo,  // ⭐ 上下文信息节点
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
      // 使用更可靠的比较方式：直接设置内容
      // 之前的 JSON.stringify 比较可能因为属性顺序不同而失败
      try {
        const currentContent = editor.getJSON()
        const currentStr = JSON.stringify(currentContent)
        const newStr = JSON.stringify(initialContent)
        
        if (currentStr !== newStr) {
          console.log('📝 NoteEditor: 检测到内容变化，更新编辑器')
          // 保存当前光标位置
          const { from, to } = editor.state.selection
          // 设置新内容
          editor.commands.setContent(initialContent)
          // 尝试恢复光标位置（如果位置有效）
          try {
            const docLength = editor.state.doc.content.size
            const safeFrom = Math.min(from, docLength)
            const safeTo = Math.min(to, docLength)
            editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
          } catch {
            // 忽略光标恢复错误
          }
        }
      } catch (error) {
        console.error('📝 NoteEditor: 更新内容失败:', error)
      }
    }
  }, [editor, initialContent])

  // ⭐ 暴露 editor 实例
  useEffect(() => {
    if (editor && editorRef) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

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
          
          // 设置任务操作菜单位置（紧贴拖拽手柄左侧，让用户感知关联）
          // 菜单宽度约 180px
          const menuWidth = 180
          
          // 紧贴拖拽手柄左侧（rect.left 是任务行左边缘，手柄在最左边）
          let menuX = rect.left - menuWidth
          
          // 如果左侧空间不够，就贴靠左边缘
          if (menuX < 5) {
            menuX = 5
          }
          
          setTaskActionMenuPosition({
            x: menuX,
            y: rect.top
          })
          
          // 保存当前任务元素
          setCurrentTaskElement(taskItem)
          
          // TODO: 提取当前任务的已有标签
          setSelectedTags([])
          
          // 显示任务操作菜单
          setShowTaskActionMenu(true)
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
        // 找到任务内容（paragraph）的末尾位置
        let contentEndPos = pos + 1 // 跳过 taskItem 开始
        
        taskNode.forEach((child, offset) => {
          if (child.type.name === 'paragraph') {
            // 找到 paragraph 的末尾
            contentEndPos = pos + offset + child.nodeSize
          }
        })
        
        // 在 paragraph 末尾插入标签（在 paragraph 内部，不是外部）
        const insertPos = contentEndPos - 1 // paragraph 结束前
        
        // 插入标签文本 + 普通空格（一次性插入，避免光标位置问题）
        editor
          .chain()
          .focus()
          .setTextSelection(insertPos)
          .insertContent([
            {
            type: 'text',
              text: tag.label, // 标签文本（带 taskTag mark）
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
            {
              type: 'text',
              text: ' ', // 普通空格（无 mark），防止继续输入时继承标签样式
            }
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

  // 打开标签选择器（从任务操作菜单调用）
  const handleOpenTagPicker = useCallback(() => {
    if (!currentTaskElement) return
    
    const rect = currentTaskElement.getBoundingClientRect()
    setTagDropdownPosition({
      x: rect.left + 35,
      y: rect.top
    })
    setShowTagDropdown(true)
  }, [currentTaskElement])

  // 打开时间选择器（从任务操作菜单调用）
  const handleOpenDateTimePicker = useCallback(() => {
    if (!currentTaskElement) return
    
    const rect = currentTaskElement.getBoundingClientRect()
    setDateTimePickerPosition({
      x: rect.left + 35,
      y: rect.top
    })
    setShowDateTimePicker(true)
  }, [currentTaskElement])
  
  // ⏳ 打开时长选择器（从任务操作菜单调用）
  const handleOpenDurationPicker = useCallback(() => {
    if (!currentTaskElement) return
    
    const rect = currentTaskElement.getBoundingClientRect()
    setDurationPickerPosition({
      x: rect.left + 35,
      y: rect.top
    })
    setShowDurationPicker(true)
  }, [currentTaskElement])

  // ⭐ 拆解任务（从任务操作菜单调用）
  const handleDecomposeTask = useCallback(() => {
    if (!editor || !currentTaskElement || !onDecompose) return
    
    try {
      // 从 DOM 中提取任务标题
      const pos = editor.view.posAtDOM(currentTaskElement, 0)
      const resolvedPos = editor.state.doc.resolve(pos)
      const taskNode = resolvedPos.parent
      
      if (taskNode && taskNode.type.name === 'taskItem') {
        // 提取任务文本内容（去除标签等）
        let taskTitle = ''
        taskNode.forEach((child) => {
          if (child.type.name === 'paragraph') {
            child.forEach((textNode) => {
              if (textNode.type.name === 'text') {
                taskTitle += textNode.text || ''
              }
            })
          }
        })
        
        // 清理任务标题（移除标签、表情等）
        taskTitle = taskTitle
          .replace(/#[\w\u4e00-\u9fa5]+/g, '') // 移除标签
          .replace(/📅.*$/g, '') // 移除时间信息
          .trim()
        
        if (taskTitle) {
          console.log('✂️ 准备拆解任务:', taskTitle)
          onDecompose(taskTitle)
        }
      }
    } catch (error) {
      console.error('❌ 提取任务信息失败:', error)
    }
  }, [editor, currentTaskElement, onDecompose])

  // 设置日期时间
  const handleSetDateTime = useCallback((value: DateTimeSetting) => {
    if (!editor || !currentTaskElement) return
    
    console.log('✅ 设置时间:', value)
    
    const pos = editor.view.posAtDOM(currentTaskElement, 0)
    
    if (value.mode === 'deadline') {
      // 截止时间模式
      editor.chain()
        .focus()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(pos)
          if (node && node.type.name === 'taskItem') {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              datetimeMode: 'deadline',
              deadlineTime: value.time.toISOString(),
              intervalStart: null,
              intervalEnd: null,
            })
            return true
          }
          return false
        })
        .run()
      
      // 更新显示 - 直接插入 DOM 元素
      const formatted = formatDateTime(value.time)
      currentTaskElement.setAttribute('data-datetime-mode', 'deadline')
      currentTaskElement.setAttribute('data-deadline-time', value.time.toISOString())
      
      console.log('🔍 调试信息:')
      console.log('  - 格式化时间:', formatted)
      console.log('  - 任务元素:', currentTaskElement)
      
      const contentDiv = currentTaskElement.querySelector(':scope > div') as HTMLElement | null
      console.log('  - contentDiv:', contentDiv)
      
      if (contentDiv) {
        // 清除旧的时间徽章
        const oldBadge = contentDiv.querySelector('.task-datetime-badge')
        if (oldBadge) {
          console.log('  - 清除旧徽章')
          oldBadge.remove()
        }
        
        // 找到最后一个 p 标签，插入到其内部
        const paragraphs = contentDiv.querySelectorAll('p')
        const targetP = paragraphs.length > 0 ? (paragraphs[paragraphs.length - 1] as HTMLElement) : null
        
        if (targetP) {
          // 创建新的时间徽章
          const badge = document.createElement('span')
          badge.className = 'task-datetime-badge'
          badge.textContent = ` 📅 ${formatted}`
          badge.contentEditable = 'false'  // 禁止编辑
          badge.style.cssText = `
            margin-left: 0.75rem;
            font-size: 1rem;
            font-weight: normal;
            color: #1f2937;
            white-space: nowrap;
            user-select: none;
            font-family: inherit;
          `
          
          // 插入到 p 标签的末尾（和文本在同一行）
          targetP.appendChild(badge)
          
          // 在徽章后面插入一个零宽空格，确保光标位置正确
          const zeroWidthSpace = document.createTextNode('\u200B')
          targetP.appendChild(zeroWidthSpace)
          
          console.log('  ✅ 时间徽章已插入到 p 标签内!')
          console.log('  - 徽章内容:', badge.textContent)
          console.log('  - 徽章在 DOM 中:', document.body.contains(badge))
        } else {
          console.log('  ⚠️ 找不到目标 p 标签')
        }
      }
    } else {
      // 时间间隔模式
      editor.chain()
        .focus()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(pos)
          if (node && node.type.name === 'taskItem') {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              datetimeMode: 'interval',
              deadlineTime: null,
              intervalStart: value.startTime.toISOString(),
              intervalEnd: value.endTime.toISOString(),
            })
            return true
          }
          return false
        })
        .run()
      
      // 更新显示 - 直接插入 DOM 元素
      const formatted = formatTimeInterval(value.startTime, value.endTime)
      currentTaskElement.setAttribute('data-datetime-mode', 'interval')
      currentTaskElement.setAttribute('data-interval-start', value.startTime.toISOString())
      currentTaskElement.setAttribute('data-interval-end', value.endTime.toISOString())
      
      console.log('🔍 调试信息 (时间间隔):')
      console.log('  - 格式化时间:', formatted)
      
      const contentDiv = currentTaskElement.querySelector(':scope > div') as HTMLElement | null
      if (contentDiv) {
        // 清除旧的时间徽章
        const oldBadge = contentDiv.querySelector('.task-datetime-badge')
        if (oldBadge) {
          console.log('  - 清除旧徽章')
          oldBadge.remove()
        }
        
        // 找到最后一个 p 标签，插入到其内部
        const paragraphs = contentDiv.querySelectorAll('p')
        const targetP = paragraphs.length > 0 ? (paragraphs[paragraphs.length - 1] as HTMLElement) : null
        
        if (targetP) {
          // 创建新的时间徽章
          const badge = document.createElement('span')
          badge.className = 'task-datetime-badge'
          badge.textContent = ` 📅 ${formatted}`
          badge.contentEditable = 'false'  // 禁止编辑
          badge.style.cssText = `
            margin-left: 0.75rem;
            font-size: 1rem;
            font-weight: normal;
            color: #1f2937;
            white-space: nowrap;
            user-select: none;
            font-family: inherit;
          `
          
          // 插入到 p 标签的末尾（和文本在同一行）
          targetP.appendChild(badge)
          
          // 在徽章后面插入一个零宽空格，确保光标位置正确
          const zeroWidthSpace = document.createTextNode('\u200B')
          targetP.appendChild(zeroWidthSpace)
          
          console.log('  ✅ 时间徽章已插入到 p 标签内!')
          console.log('  - 徽章内容:', badge.textContent)
          console.log('  - 徽章在 DOM 中:', document.body.contains(badge))
        } else {
          console.log('  ⚠️ 找不到目标 p 标签')
        }
      }
    }
    
    setShowDateTimePicker(false)
    console.log('✅ 时间设置完成')
  }, [editor, currentTaskElement])

  // 处理时长设置
  const handleSetDuration = useCallback((duration: number) => {
    if (!editor || !currentTaskElement) return
    
    console.log('✅ 设置时长:', duration)
    
    const pos = editor.view.posAtDOM(currentTaskElement, 0)
    
    editor.chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos)
        if (node && node.type.name === 'taskItem') {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            estimatedDuration: duration
          })
          return true
        }
        return false
      })
      .run()
      
    // 更新显示 - 直接插入 DOM 元素
    const formatted = duration >= 60 
      ? `${Number((duration / 60).toFixed(1))}h`
      : `${duration}m`
      
    currentTaskElement.setAttribute('data-estimated-duration', String(duration))
    
    const contentDiv = currentTaskElement.querySelector(':scope > div') as HTMLElement | null
    if (contentDiv) {
      // 清除旧的时长徽章
      const oldBadge = contentDiv.querySelector('.task-duration-badge')
      if (oldBadge) oldBadge.remove()
      
      // 找到最后一个 p 标签
      const paragraphs = contentDiv.querySelectorAll('p')
      const targetP = paragraphs.length > 0 ? (paragraphs[paragraphs.length - 1] as HTMLElement) : null
      
      if (targetP) {
        const badge = document.createElement('span')
        badge.className = 'task-duration-badge'
        badge.textContent = ` ⏳ ${formatted}`
        badge.contentEditable = 'false'
        badge.style.cssText = `
          margin-left: 0.75rem;
          font-size: 0.875rem;
          font-weight: normal;
          color: #6b7280;
          white-space: nowrap;
          user-select: none;
          font-family: inherit;
        `
        targetP.appendChild(badge)
        
        // 插入零宽空格
        targetP.appendChild(document.createTextNode('\u200B'))
      }
    }
    
    setShowDurationPicker(false)
  }, [editor, currentTaskElement])
  
  // 格式化单个时间
  function formatDateTime(date: Date): string {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '/').replace(/\s/g, ' ')
  }
  
  // 格式化时间间隔
  function formatTimeInterval(start: Date, end: Date): string {
    const startStr = start.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '/').replace(/\s/g, ' ')
    
    const endStr = end.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '/').replace(/\s/g, ' ')
    
    // 检查是否同一天
    if (start.toDateString() === end.toDateString()) {
      const date = start.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      })
      const startTime = start.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
      const endTime = end.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
      return `${date} ${startTime}-${endTime}`
    }
    
    return `${startStr} - ${endStr}`
  }

  // 清理任务项中错误的时间徽章
  useEffect(() => {
    if (!editor) return

    const cleanUpBadges = () => {
      const editorElement = editor.view.dom
      
      // 清理所有不应该有时间徽章的任务
      const allTasks = editorElement.querySelectorAll('li[data-drag-handle]')
      allTasks.forEach((task) => {
        const hasDatetime = task.hasAttribute('data-datetime-mode')
        
        if (!hasDatetime) {
          // 这个任务不应该有时间，清除所有时间徽章
          const badges = task.querySelectorAll('.task-datetime-badge')
          badges.forEach(badge => badge.remove())
        }
      })
    }

    cleanUpBadges()
    
    const handler = () => cleanUpBadges()
    editor.on('update', handler)

    return () => {
      editor.off('update', handler)
    }
  }, [editor])

  // 同步所有任务项的时间显示 - 使用真实 DOM 元素
  useEffect(() => {
    console.log('⚡ useEffect 触发了，editor:', !!editor)
    if (!editor) {
      console.log('❌ editor 不存在，退出')
      return
    }

    const updateDateTimeDisplays = () => {
      console.log('🔄 开始更新时间显示...')
      const editorElement = editor.view.dom
      const taskItems = editorElement.querySelectorAll('li[data-datetime-mode]')
      console.log('📋 找到任务数:', taskItems.length)

      taskItems.forEach((item, index) => {
        console.log(`\n处理任务 ${index + 1}:`)
        const mode = item.getAttribute('data-datetime-mode')
        console.log('  - 模式:', mode)
        
        const contentDiv = (item.querySelector(':scope > div') as HTMLElement | null) || (item.querySelector('div') as HTMLElement | null)
        console.log('  - 找到 contentDiv:', !!contentDiv)
        
        if (!contentDiv) {
          console.log('  ❌ 没有 contentDiv，跳过')
          return
        }
        
        // 清除旧的时间显示元素
        const oldBadge = contentDiv.querySelector('.task-datetime-badge')
        if (oldBadge) {
          console.log('  - 清除旧徽章')
          oldBadge.remove()
        }

        let formatted = ''
        let icon = ''
        let color = ''
        const now = Date.now()

        if (mode === 'deadline') {
          const iso = item.getAttribute('data-deadline-time')
          if (!iso) {
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          const deadline = new Date(iso)
          if (Number.isNaN(deadline.getTime())) {
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          formatted = formatDateTime(deadline)
          icon = '📅'
          const isExpired = deadline.getTime() < now
          color = isExpired ? '#dc2626' : '#f59e0b'
          item.classList.toggle('datetime-expired', isExpired)
          item.classList.remove('datetime-active')
        } else if (mode === 'interval') {
          const startIso = item.getAttribute('data-interval-start')
          const endIso = item.getAttribute('data-interval-end')

          if (!startIso || !endIso) {
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          const startDate = new Date(startIso)
          const endDate = new Date(endIso)

          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          formatted = formatTimeInterval(startDate, endDate)
          icon = '⏰'

          const nowTime = now
          const isExpired = endDate.getTime() < nowTime
          const isActive = !isExpired && nowTime >= startDate.getTime()

          if (isExpired) {
            color = '#dc2626'
          } else if (isActive) {
            color = '#0ea5e9'
          } else {
            color = '#10b981'
          }

          item.classList.toggle('datetime-expired', isExpired)
          item.classList.toggle('datetime-active', isActive)
        }

        if (formatted) {
          console.log('  ✅ 准备插入徽章:', `${icon} ${formatted}`)
          
          // 创建真实的 DOM 元素来显示时间
          const badge = document.createElement('span')
          badge.className = 'task-datetime-badge'
          badge.textContent = ` ${icon} ${formatted}`
          badge.style.cssText = `
            margin-left: 0.75rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: ${color};
            white-space: nowrap;
          `
          
          // 插入到 contentDiv 的末尾
          contentDiv.appendChild(badge)
          console.log('  ✅ 徽章已插入，当前 contentDiv 子元素数:', contentDiv.children.length)
          console.log('  ✅ 徽章是否在 DOM 中:', document.body.contains(badge))
        } else {
          console.log('  ⚠️ 没有格式化的时间，跳过插入')
        }
      })
    }

    console.log('🚀 初始调用 updateDateTimeDisplays')
    updateDateTimeDisplays()

    const handler = () => {
      console.log('📝 编辑器 update 事件触发')
      updateDateTimeDisplays()
    }
    editor.on('update', handler)
    console.log('✅ 已注册 update 事件监听')

    return () => {
      console.log('🧹 清理 update 事件监听')
      editor.off('update', handler)
    }
  }, [editor])

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* 编辑器主体（可滚动区域） */}
      <div className="flex-1 overflow-y-auto">
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

      {/* 任务操作菜单 */}
      {showTaskActionMenu && (
        <TaskActionMenu
          position={taskActionMenuPosition}
          onOpenTagPicker={handleOpenTagPicker}
          onOpenDateTimePicker={handleOpenDateTimePicker}
          onOpenDurationPicker={handleOpenDurationPicker}
          onDecompose={handleDecomposeTask}
          onClose={() => setShowTaskActionMenu(false)}
        />
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

      {/* 时间选择器 */}
      {showDateTimePicker && (
        <DateTimePicker
          position={dateTimePickerPosition}
          onSelect={handleSetDateTime}
          onClose={() => setShowDateTimePicker(false)}
        />
      )}

      {/* ⏳ 时长选择器 */}
      {showDurationPicker && (
        <TaskDurationPicker
          position={durationPickerPosition}
          onSelect={handleSetDuration}
          onClose={() => setShowDurationPicker(false)}
        />
      )}
      </div>

      {/* 底部提示栏（固定在底部） */}
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


