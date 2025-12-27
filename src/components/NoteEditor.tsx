'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { Extension, InputRule, Node } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { Plugin as ProseMirrorPlugin } from '@tiptap/pm/state'
import { mergeAttributes } from '@tiptap/core'
import { TaskTag } from '@/components/extensions/TaskTag'
import TagDropdown from '@/components/TagDropdown'
import TaskActionMenu from '@/components/TaskActionMenu'
import DateTimePicker from '@/components/DateTimePicker'
import TaskDurationPicker from '@/components/TaskDurationPicker'
import type { PresetTag } from '@/constants/tags'
import type { DateTimeSetting } from '@/types/datetime'

// ⭐ 让 paragraph 支持 data-datetime-display（必须写进文档 JSON，才能稳定被 CSS 命中）
const DatetimeParagraph = Paragraph.extend({
  addAttributes() {
    return {
      datetimeDisplay: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-datetime-display'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.datetimeDisplay) return {}
          return { 'data-datetime-display': String(attributes.datetimeDisplay) }
        },
      },
    }
  },
})

// ⭐ 自定义上下文信息节点
const ContextInfo = Node.create({
  name: 'contextInfo',
  
  group: 'block',
  
  content: 'text*',
  
  addAttributes() {
    return {
      contextId: {
        default: null,
        parseHTML: element => {
          const value = element.getAttribute('data-context-id')
          console.log('🔍 parseHTML - contextId:', value)
          return value
        },
        renderHTML: attributes => {
          console.log('🎨 renderHTML attributes.contextId:', attributes.contextId)
          if (!attributes.contextId) return {}
          return {
            'data-context-id': attributes.contextId
          }
        }
      },
      taskTitle: {
        default: null,
        parseHTML: element => {
          const value = element.getAttribute('data-task-title')
          console.log('🔍 parseHTML - taskTitle:', value)
          return value
        },
        renderHTML: attributes => {
          console.log('🎨 renderHTML attributes.taskTitle:', attributes.taskTitle)
          if (!attributes.taskTitle) return {}
          return {
            'data-task-title': attributes.taskTitle
          }
        }
      }
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'p.context-info',
      },
    ]
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const contextId = node.attrs.contextId
    const taskTitle = node.attrs.taskTitle
    
    console.log('🎨 渲染 ContextInfo 节点:', { contextId, taskTitle, allAttrs: node.attrs })
    
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 
        class: 'context-info-wrapper group relative',
        'data-context-id': contextId || '',
        'data-task-title': taskTitle || ''
      }),
      [
        'p',
        { class: 'context-info' },
        0
      ],
      [
        'button',
        {
          class: 'context-delete-btn absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-400 text-white text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-gray-600',
          contenteditable: 'false',
          'data-delete-context': 'true'
        },
        '×'
      ]
    ]
  },
  
  addKeyboardShortcuts() {
    return {
      // 按Enter键退出上下文信息块（只在 contextInfo 节点内生效）
      Enter: ({ editor }) => {
        // 检查当前节点是否是 contextInfo
        const { $from } = editor.state.selection
        const node = $from.node()
        const parent = $from.parent
        
        // 只有在 contextInfo 节点内才处理
        if (parent.type.name === 'contextInfo' || node.type.name === 'contextInfo') {
          return editor.commands.splitBlock()
        }
        
        // 否则让其他扩展处理（比如 TaskItem）
        return false
      },
    }
  },
})

// 自定义 TaskItem 支持拖拽和键盘快捷键
const DraggableTaskItem = TaskItem.extend({
  draggable: true,
  
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem('taskItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('taskItem'),
      Tab: () => this.editor.commands.sinkListItem('taskItem'),
    }
  },
  
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes: Record<string, unknown>) => {
          return { 'data-checked': attributes.checked ? 'true' : 'false' }
        },
      },
      'data-drag-handle': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-drag-handle'),
        renderHTML: (attributes: Record<string, unknown>) => {
          return {
            'data-drag-handle': '',
          }
        },
      },
      // 时间设置相关属性
      datetimeMode: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-datetime-mode'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.datetimeMode) return {}
          return {
            'data-datetime-mode': attributes.datetimeMode,
          }
        },
      },
      deadlineTime: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-deadline-time'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.deadlineTime) return {}
          return {
            'data-deadline-time': attributes.deadlineTime,
          }
        },
      },
      intervalStart: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-interval-start'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.intervalStart) return {}
          return {
            'data-interval-start': attributes.intervalStart,
          }
        },
      },
      intervalEnd: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-interval-end'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.intervalEnd) return {}
          return {
            'data-interval-end': attributes.intervalEnd,
          }
        },
      },
      // ⏳ 新增：预计时长属性
      estimatedDuration: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute('data-estimated-duration')
          return val ? parseInt(val, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.estimatedDuration) return {}
          return {
            'data-estimated-duration': attributes.estimatedDuration,
          }
        },
      },
    }
  },
})

// ⭐ 用于跟踪 composition 状态（解决中文输入法问题）
let isComposing = false
let compositionEndTime = 0  // 记录 composition 结束的时间

const TaskListMarkdown = Extension.create({
  name: 'taskListMarkdown',
  
  // ⭐ 添加 composition 事件监听（解决中文输入法问题）
  addProseMirrorPlugins() {
    return [
      new ProseMirrorPlugin({
        props: {
          handleDOMEvents: {
            compositionstart: () => {
              isComposing = true
              console.log('🔤 compositionstart: isComposing =', isComposing)
              return false
            },
            compositionend: () => {
              compositionEndTime = Date.now()
              console.log('🔤 compositionend: 延迟重置 isComposing')
              // ⭐ 延迟 300ms 重置，确保 inputRule 不会在 composition 结束时误触发
              // Mac 拼音输入法的空格确认可能会触发 InputRule
              setTimeout(() => {
                isComposing = false
                console.log('🔤 setTimeout: isComposing = false')
              }, 300)
              return false
            },
          },
        },
      }),
    ]
  },
  
  addInputRules() {
    return [
      new InputRule({
        find: /^(\s*)\[\]\s$/,
        handler: ({ range, commands }) => {
          // ⭐ 如果正在进行中文输入，或者刚刚结束输入（500ms内），不触发规则
          const timeSinceCompositionEnd = Date.now() - compositionEndTime
          if (isComposing || timeSinceCompositionEnd < 500) {
            console.log('🚫 InputRule 被阻止: isComposing=', isComposing, ', timeSinceEnd=', timeSinceCompositionEnd)
            return null
          }
          console.log('✅ InputRule 触发: 创建 TaskList')
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleTaskList()
        }
      }),
      new InputRule({
        find: /^(\s*)([-+*])\s$/,
        handler: ({ range, commands }) => {
          if (isComposing) return null
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleBulletList()
        }
      }),
      new InputRule({
        find: /^(\s*)(\d+)\.\s$/,
        handler: ({ range, commands }) => {
          if (isComposing) return null
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleOrderedList()
        }
      }),
      new InputRule({
        find: /^(\s*)#\s$/,
        handler: ({ range, commands }) => {
          if (isComposing) return null
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleHeading({ level: 1 })
        }
      }),
      new InputRule({
        find: /^(\s*)##\s$/,
        handler: ({ range, commands }) => {
          if (isComposing) return null
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleHeading({ level: 2 })
        }
      }),
      new InputRule({
        find: /^(\s*)###\s$/,
        handler: ({ range, commands }) => {
          if (isComposing) return null
          commands.deleteRange({ from: range.from, to: range.to })
          commands.toggleHeading({ level: 3 })
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
  autoSaveDelay = 500  // ⚡ 减少到 500ms，让保存更及时
}: NoteEditorProps) {
  
  const [showBubbleMenu, setShowBubbleMenu] = useState(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState({ top: 0, left: 0 })
  // ⭐ 拖拽开关：只有“把手区域”按下才允许 dragstart
  const allowDragRef = useRef<HTMLElement | null>(null)
  
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

  // 用于节流 DOM 同步：避免 editor update 时频繁全量遍历造成卡顿
  const datetimeSyncScheduledRef = useRef(false)
  // ⭐ 输入法(IME)组合输入保护：composition 期间不要触发自动保存/外部 setContent，否则容易出现重复/乱码
  const isComposingRef = useRef(false)
  
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // 我们用自定义的 DatetimeParagraph 替代默认 paragraph（否则自定义属性会被 ProseMirror 清掉）
        paragraph: false,
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
      DatetimeParagraph,
      TaskList,
      DraggableTaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item-with-drag-handle',
          draggable: 'true', // ⭐ 让浏览器始终能触发 dragstart（再用“把手区域开关”限制真正拖拽）
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
      handleDOMEvents: {
        compositionstart: (): boolean => {
          isComposingRef.current = true
          // 取消可能已经排队的自动保存，避免拼字过程中触发保存/同步引发内容重置
          if (typeof (debouncedSave as any)?.cancel === 'function') {
            ;(debouncedSave as any).cancel()
          }
          return false
        },
        compositionend: (): boolean => {
          isComposingRef.current = false
          return false
        },
      },
      handleKeyDown: (view, event): boolean => {
        // 处理 Tab 键缩进
        if (event.key === 'Tab') {
          event.preventDefault()
          
          // 使用 view.dispatch 和 prosemirror commands 来处理缩进
          // 暂时返回 false 让 Tiptap 的默认行为处理
          return false
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON()
      
      // 实时更新回调（不防抖）
      onUpdate?.(content)
      
      // 自动保存（防抖）
      // ⚠️ 输入法拼字(composition)期间跳过自动保存，否则容易触发外部同步(setContent)导致输入重复/乱码
      if (autoSave && onSave && !isComposingRef.current) {
        debouncedSave(content)
      }
    },
    onBlur: ({ editor }) => {
      // ⭐ 编辑器失焦时立即保存
      if (autoSave && onSave) {
        const content = editor.getJSON()
        console.log('👁️ 编辑器失焦，立即保存')
        onSave(content)
      }
    },
  })

  // 立即保存函数（不防抖）
  const immediateSave = useCallback(() => {
    if (editor && onSave) {
      const content = editor.getJSON()
      console.log('💾 立即保存笔记内容')
      onSave(content)
    }
  }, [editor, onSave])

  // 防抖保存函数
  const debouncedSave = useCallback(
    debounce((content: JSONContent) => {
      onSave?.(content)
    }, autoSaveDelay),
    [onSave, autoSaveDelay]
  )

  // ⭐ 页面卸载前强制保存（仅用于防止用户意外关闭标签页丢失数据）
  // 注意：异步保存在页面卸载时可能失败，所以只记录日志，不弹窗
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (editor && onSave) {
        const content = editor.getJSON()
        console.log('🔄 页面卸载前尝试保存（可能不会成功）')
        // 使用 try-catch 包裹，避免在页面卸载时因异步失败而弹窗
        try {
          onSave(content)
        } catch (e) {
          console.log('⚠️ 页面卸载时保存失败（正常现象）')
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // ❌ 移除组件卸载时的保存调用
      // 因为：1) 防抖保存已经保存了最新内容
      //       2) 页面关闭时异步操作会失败并弹出错误提示
      // handleBeforeUnload() // 不再调用
    }
  }, [editor, onSave])

  // 🔧 修复：使用 ref 记录编辑器是否已初始化
  // 只在首次加载时设置内容，之后忽略外部 initialContent 变化
  // 防止保存后的 setCurrentNote 导致编辑器内容被覆盖
  const isInitializedRef = useRef(false)
  
  // 当 initialContent 改变时更新编辑器（仅首次）
  useEffect(() => {
    // 如果 initialContent 为空（正在加载中），不做任何操作
    // 等待真正的内容到来
    if (!editor || !initialContent) {
      console.log('📝 NoteEditor: 等待内容加载...')
      return
    }
    
    // 如果已经初始化过，忽略外部内容变化
    // 这样用户编辑过程中不会被保存后的旧内容覆盖
    if (isInitializedRef.current) {
      console.log('📝 NoteEditor: 已初始化，忽略外部内容更新')
      return
    }
    
    try {
      const currentContent = editor.getJSON()
      const currentStr = JSON.stringify(currentContent)
      const newStr = JSON.stringify(initialContent)
      
      if (currentStr !== newStr) {
        console.log('📝 NoteEditor: 首次加载，设置编辑器内容')
        // 保存当前光标位置
        const { from, to } = editor.state.selection
        // 设置新内容
        editor.commands.setContent(initialContent)
        // 标记已初始化
        isInitializedRef.current = true
        // 尝试恢复光标位置（如果位置有效）
        try {
          const docLength = editor.state.doc.content.size
          const safeFrom = Math.min(from, docLength)
          const safeTo = Math.min(to, docLength)
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
        } catch {
          // 忽略光标恢复错误
        }
      } else {
        // 内容相同也标记为已初始化
        isInitializedRef.current = true
      }
    } catch (error) {
      console.error('📝 NoteEditor: 更新内容失败:', error)
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
    // ⭐ 记录被拖拽任务在 ProseMirror 文档中的位置（用于真正“移动任务”）
    let draggedTaskFromPos: number | null = null
    let draggedTaskToPos: number | null = null
    let draggedTaskParentListPos: number | null = null

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const taskItem = target.closest('li[data-type="taskItem"]')
      
      if (taskItem) {
        // ⭐ 只有从“把手区域”按下才允许拖拽
        if (allowDragRef.current !== taskItem) {
          // 不允许的拖拽：直接取消，避免误触
          if (e.cancelable) e.preventDefault()
          return
        }

        draggedElement = taskItem as HTMLElement

        // --- 1) 记录被拖拽任务的文档位置 ---
        try {
          const view = editor.view
          const state = editor.state
          const pos = view.posAtDOM(taskItem, 0)
          const $pos = state.doc.resolve(pos)

          // 找到 taskItem 的深度
          let taskItemDepth: number | null = null
          for (let d = $pos.depth; d >= 0; d--) {
            if ($pos.node(d).type.name === 'taskItem') {
              taskItemDepth = d
              break
            }
          }

          if (taskItemDepth == null) {
            console.warn('⚠️ 拖拽开始：无法定位 taskItem 节点，取消拖拽移动逻辑')
            draggedTaskFromPos = null
            draggedTaskToPos = null
            draggedTaskParentListPos = null
          } else {
            const fromPos = $pos.before(taskItemDepth)
            const node = $pos.node(taskItemDepth)
            const toPos = fromPos + node.nodeSize

            // 记录父 taskList 位置（用于限制只在同一层级移动）
            const parentDepth = taskItemDepth - 1
            const parentPos = parentDepth >= 0 ? $pos.before(parentDepth) : null

            draggedTaskFromPos = fromPos
            draggedTaskToPos = toPos
            draggedTaskParentListPos = parentPos

            console.log('🧲 拖拽开始(记录位置):', {
              fromPos,
              toPos,
              parentListPos: parentPos,
              nodeSize: node.nodeSize,
            })
          }
        } catch (err) {
          console.warn('⚠️ 拖拽开始：记录文档位置失败，取消移动逻辑', err)
          draggedTaskFromPos = null
          draggedTaskToPos = null
          draggedTaskParentListPos = null
        }
        
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
        // 某些浏览器需要 setData 才会真正进入可 drop 状态
        try {
          e.dataTransfer?.setData('text/plain', 'taskItem')
        } catch {}
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
      // 清理“允许拖拽”开关
      allowDragRef.current = null
      // 清理记录的文档位置
      draggedTaskFromPos = null
      draggedTaskToPos = null
      draggedTaskParentListPos = null
      
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

    // ⭐ drop：真正移动任务（调整任务顺序）
    const handleDrop = (e: DragEvent) => {
      if (!editor) return
      if (draggedTaskFromPos == null || draggedTaskToPos == null) return

      e.preventDefault()
      e.stopPropagation()

      const view = editor.view
      const state = editor.state

      // 找到 drop 的目标 taskItem（DOM 级别）
      const target = e.target as HTMLElement
      const targetTaskLi = target.closest('li[data-type="taskItem"]') as HTMLElement | null
      if (!targetTaskLi || !draggedElement) return
      if (targetTaskLi === draggedElement) return

      // 找到目标 taskItem 在文档中的位置
      let targetFromPos: number | null = null
      let targetToPos: number | null = null
      let targetParentListPos: number | null = null
      try {
        const pos = view.posAtDOM(targetTaskLi, 0)
        const $pos = state.doc.resolve(pos)
        let taskItemDepth: number | null = null
        for (let d = $pos.depth; d >= 0; d--) {
          if ($pos.node(d).type.name === 'taskItem') {
            taskItemDepth = d
            break
          }
        }
        if (taskItemDepth == null) return
        const node = $pos.node(taskItemDepth)
        targetFromPos = $pos.before(taskItemDepth)
        targetToPos = targetFromPos + node.nodeSize
        const parentDepth = taskItemDepth - 1
        targetParentListPos = parentDepth >= 0 ? $pos.before(parentDepth) : null
      } catch (err) {
        console.warn('⚠️ drop：解析目标位置失败', err)
        return
      }

      // 限制：只允许同一层级（同一个 taskList）内移动，避免嵌套结构被破坏
      if (
        draggedTaskParentListPos != null &&
        targetParentListPos != null &&
        draggedTaskParentListPos !== targetParentListPos
      ) {
        console.warn('⚠️ 当前仅支持同一层级任务排序（不同父任务/不同列表暂不支持）')
        return
      }

      // 判断插入到目标的“上方/下方”
      const rect = targetTaskLi.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      let insertPos = e.clientY < midpoint ? targetFromPos! : targetToPos!

      const fromPos = draggedTaskFromPos
      const toPos = draggedTaskToPos
      const movedSize = toPos - fromPos

      // 如果插入点落在被删除区间内部，直接忽略
      if (insertPos >= fromPos && insertPos <= toPos) {
        return
      }

      // 删除源节点后，如果 insertPos 在源节点之后，需要减去 movedSize 进行位置修正
      if (insertPos > fromPos) {
        insertPos -= movedSize
      }

      const slice = state.doc.slice(fromPos, toPos)
      const tr = state.tr
        .delete(fromPos, toPos)
        .replaceRange(insertPos, insertPos, slice)
        .scrollIntoView()

      console.log('✅ 任务排序 drop 成功:', { fromPos, toPos, insertPos })
      view.dispatch(tr)
    }

    editorElement.addEventListener('dragstart', handleDragStart)
    editorElement.addEventListener('dragend', handleDragEnd)
    editorElement.addEventListener('dragover', handleDragOver)
    editorElement.addEventListener('dragenter', handleDragEnter)
    editorElement.addEventListener('dragleave', handleDragLeave)
    editorElement.addEventListener('drop', handleDrop)

    return () => {
      editorElement.removeEventListener('dragstart', handleDragStart)
      editorElement.removeEventListener('dragend', handleDragEnd)
      editorElement.removeEventListener('dragover', handleDragOver)
      editorElement.removeEventListener('dragenter', handleDragEnter)
      editorElement.removeEventListener('dragleave', handleDragLeave)
      editorElement.removeEventListener('drop', handleDrop)
      
      // 清理可能残留的拖拽预览
      if (dragImage && document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }
  }, [editor])

  // ⭐ 监听上下文信息删除按钮点击
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom

    const handleContextDelete = async (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // 检查是否点击了删除按钮
      if (target.getAttribute('data-delete-context') === 'true') {
        e.preventDefault()
        e.stopPropagation()
        
        console.log('🗑️ 点击删除按钮')
        
        // 找到上下文信息容器
        const wrapper = target.closest('.context-info-wrapper')
        if (!wrapper) {
          console.warn('⚠️ 找不到上下文信息容器')
          return
        }
        
        // 获取 context-id 和 task-title
        const contextId = wrapper.getAttribute('data-context-id') || ''
        const taskTitleFromAttr = wrapper.getAttribute('data-task-title') || ''
        const contentTextRaw = (wrapper.querySelector('p')?.textContent || wrapper.textContent || '')
          .replace('×', '')
          .trim()
        const contextContent = contentTextRaw.replace(/^💡\s*/g, '').trim()

        // 尝试推断所属任务标题（用于旧节点无属性场景）
        let inferredTaskTitle = ''
        const taskLi = wrapper.closest('li[data-type="taskItem"]') as HTMLElement | null
        console.log('🔍 查找父级taskItem:', taskLi ? '找到' : '未找到')
        
        if (taskLi) {
          const taskDiv = taskLi.querySelector('div') as HTMLElement | null
          const firstP = taskDiv?.querySelector('p') as HTMLParagraphElement | null
          inferredTaskTitle = (firstP?.textContent || '').trim()
          console.log('🔍 从DOM推断任务标题:', inferredTaskTitle)
        }

        // 如果 DOM 层级推断不到（contextInfo 可能被提升到 taskList 外），用文档位置反推"最近的上一条任务"
        if (!inferredTaskTitle) {
          console.log('🔍 尝试通过文档位置推断任务标题...')
          try {
            const { state, view } = editor
            const domPos = view.posAtDOM(wrapper as HTMLElement, 0)
            console.log('🔍 wrapper DOM位置:', domPos)
            
            let lastTaskTitle = ''
            state.doc.nodesBetween(0, domPos, (node: ProseMirrorNode, pos: number) => {
              console.log('🔍 遍历节点:', node.type.name, 'at pos', pos)
              if (node.type.name === 'taskItem') {
                // taskItem 第一个子节点通常是 paragraph（任务标题）
                const first = node.firstChild
                lastTaskTitle = (first?.textContent || node.textContent || '').trim()
                console.log('🔍 找到taskItem, 标题:', lastTaskTitle)
              }
              return true
            })
            inferredTaskTitle = lastTaskTitle
            console.log('🔍 最终推断的任务标题:', inferredTaskTitle)
          } catch (err) {
            console.warn('⚠️ 通过文档位置推断任务标题失败:', err)
          }
        }

        const taskTitle = taskTitleFromAttr || inferredTaskTitle
        
        console.log('📋 准备删除:', { contextId, taskTitle, contextContent })
        
        // 确认删除
        if (!confirm(`确定要删除这条上下文信息吗？\n\n"💡 ${contextContent}"`)) {
          return
        }
        
        try {
          // 1) 尽可能从数据库删除
          if (contextId) {
            const { deleteContextInfo } = await import('@/lib/taskContextService')
            await deleteContextInfo(contextId)
            console.log('✅ 数据库删除成功(通过contextId)')
          } else if (taskTitle && contextContent) {
            // 兼容旧节点：用「任务标题 + 内容」反查数据库记录
            const supabase = (await import('@/lib/supabase-client')).createClient()
            const { data: dailyTasks, error: taskErr } = await supabase
              .from('daily_tasks')
              .select('id, title')
              .eq('title', taskTitle)
              .limit(1)
            if (!taskErr && dailyTasks && dailyTasks.length > 0) {
              const realTaskId = dailyTasks[0].id
              // 先尝试精确匹配；失败则拉取最近若干条做包含匹配
              const { data: exactRows, error: exactErr } = await supabase
                .from('task_context_info')
                .select('id, content')
                .eq('task_id', realTaskId)
                .eq('content', contextContent)
                .order('created_at', { ascending: false })
                .limit(1)
              if (!exactErr && exactRows && exactRows.length > 0) {
                const { deleteContextInfo } = await import('@/lib/taskContextService')
                await deleteContextInfo(exactRows[0].id)
                console.log('✅ 数据库删除成功(通过标题+内容精确匹配)')
              } else {
                const { data: ctxRows, error: ctxErr } = await supabase
                  .from('task_context_info')
                  .select('id, content')
                  .eq('task_id', realTaskId)
                  .order('created_at', { ascending: false })
                  .limit(30)
                if (!ctxErr && ctxRows && ctxRows.length > 0) {
                  const found = ctxRows.find(r => (r.content || '').includes(contextContent) || contextContent.includes(r.content || ''))
                  if (found) {
                    const { deleteContextInfo } = await import('@/lib/taskContextService')
                    await deleteContextInfo(found.id)
                    console.log('✅ 数据库删除成功(通过标题+内容模糊匹配)')
                  } else {
                    console.warn('⚠️ 数据库未找到匹配记录（内容不一致），将仅从笔记删除')
                  }
                } else {
                  console.warn('⚠️ 数据库未找到匹配记录（查询失败或为空），将仅从笔记删除')
                }
              }
            } else {
              console.warn('⚠️ 数据库未找到对应任务（标题匹配失败），将仅从笔记删除')
            }
          } else {
            console.warn('⚠️ 缺少contextId且无法推断任务标题，将仅从笔记删除')
          }
          
          // 2) 从编辑器中删除节点（优先按contextId匹配；否则按点击位置删除）
          const { state, view } = editor
          let deletedPos: number | null = null
          
          if (contextId) {
            state.doc.descendants((node: ProseMirrorNode, pos: number) => {
              if (node.type.name === 'contextInfo') {
                const attrs = node.attrs as Record<string, unknown>
                console.log('🔍 检查节点属性:', attrs)
                if (attrs.contextId === contextId) {
                  deletedPos = pos
                  return false
                }
              }
            })
          }

          if (deletedPos === null) {
            // 兜底：根据DOM位置删除（适配旧节点无attrs）
            try {
              const domPos = view.posAtDOM(wrapper as HTMLElement, 0)
              const resolved = state.doc.resolve(domPos)
              // 尝试向上找contextInfo节点
              for (let d = resolved.depth; d > 0; d--) {
                const n = resolved.node(d)
                if (n.type.name === 'contextInfo') {
                  deletedPos = resolved.start(d)
                  break
                }
              }
              if (deletedPos === null) {
                // 最后兜底：删除当前位置的父块
                deletedPos = resolved.before(resolved.depth)
              }
            } catch (err) {
              console.warn('⚠️ posAtDOM 失败，无法定位删除位置:', err)
            }
          }
          
          if (deletedPos !== null) {
            const nodeAt = state.doc.nodeAt(deletedPos)
            if (!nodeAt) {
              console.warn('⚠️ 删除位置未找到节点，取消删除')
              return
            }
            const transaction = state.tr.delete(deletedPos, deletedPos + nodeAt.nodeSize)
            view.dispatch(transaction)
            console.log('✅ 编辑器节点删除成功')
          } else {
            console.warn('⚠️ 未找到要删除的节点')
          }
          
        } catch (error) {
          console.error('❌ 删除失败:', error)
          alert('删除失败，请重试')
        }
      }
    }

    editorElement.addEventListener('click', handleContextDelete)

    return () => {
      editorElement.removeEventListener('click', handleContextDelete)
    }
  }, [editor])

  // 处理拖拽手柄左键点击，显示标签菜单
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom

    // 记录鼠标按下位置，用于区分点击和拖拽
    let mouseDownX = 0
    let mouseDownY = 0
    let mouseDownTime = 0
    let clickedTaskItem: HTMLElement | null = null
    // ⭐ 只有在“把手区域”按下，才允许本次 dragstart 生效
    let allowDragForTaskItem: HTMLElement | null = null
    
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
          // 记录鼠标按下位置和时间
          mouseDownX = e.clientX
          mouseDownY = e.clientY
          mouseDownTime = Date.now()
          clickedTaskItem = taskItem
          allowDragRef.current = taskItem
        }
      }
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (clickedTaskItem) {
        const timeDiff = Date.now() - mouseDownTime
        const dx = Math.abs(e.clientX - mouseDownX)
        const dy = Math.abs(e.clientY - mouseDownY)
        
        // 如果是短按（< 200ms）且没有移动太多（< 5px），显示任务操作菜单
        if (timeDiff < 200 && dx < 5 && dy < 5) {
          const rect = clickedTaskItem.getBoundingClientRect()
          
          // 设置任务操作菜单位置 - 显示在拖拽把手右侧
          const menuWidth = 180
          // 菜单显示在拖拽把手的右边（任务内容的左侧）
          let menuX = rect.left + 30  // 拖拽把手区域约 30px
          
          // 如果右侧空间不够，就显示在左侧
          if (menuX + menuWidth > window.innerWidth - 10) {
            menuX = rect.left - menuWidth - 10
          }
          
          // 确保不超出左边界
          if (menuX < 10) {
            menuX = 10
          }
          
          // 确保不超出上下边界
          let menuY = rect.top
          if (menuY < 10) {
            menuY = 10
          }
          if (menuY + 300 > window.innerHeight) {  // 假设菜单高度约 300px
            menuY = window.innerHeight - 310
          }
          
          setTaskActionMenuPosition({
            x: menuX,
            y: menuY
          })
          
          setCurrentTaskElement(clickedTaskItem)
          setSelectedTags([])
          setShowTaskActionMenu(true)
        }
        
        // 清理状态
        clickedTaskItem = null
        allowDragRef.current = null
      }
    }

    editorElement.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      editorElement.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mouseup', handleMouseUp)
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
        
        taskNode.forEach((child: ProseMirrorNode, offset: number) => {
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
        taskNode.descendants((node: ProseMirrorNode, pos: number) => {
          if (found) return false
          
          if (node.marks) {
            node.marks.forEach((mark) => {
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
        taskNode.forEach((child: ProseMirrorNode) => {
          if (child.type.name === 'paragraph') {
            child.forEach((textNode: ProseMirrorNode) => {
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

  // 🗑️ 删除任务（从任务操作菜单调用）
  const handleDeleteTask = useCallback(() => {
    if (!editor || !currentTaskElement) return
    
    try {
      // 找到任务在编辑器中的位置
      const pos = editor.view.posAtDOM(currentTaskElement, 0)
      const resolvedPos = editor.state.doc.resolve(pos)
      const taskNode = resolvedPos.parent
      
      if (taskNode && taskNode.type.name === 'taskItem') {
        // 提取任务标题用于确认
        let taskTitle = ''
        taskNode.forEach((child: ProseMirrorNode) => {
          if (child.type.name === 'paragraph') {
            child.forEach((textNode: ProseMirrorNode) => {
              if (textNode.type.name === 'text') {
                taskTitle += textNode.text || ''
              }
            })
          }
        })
        
        // 清理任务标题
        taskTitle = taskTitle
          .replace(/#[\w\u4e00-\u9fa5]+/g, '')
          .replace(/📅.*$/g, '')
          .trim()
        
        // 确认删除
        if (!confirm(`确定要删除任务「${taskTitle}」吗？`)) {
          return
        }
        
        // 找到 taskItem 的起始位置和结束位置
        const taskItemPos = resolvedPos.before(resolvedPos.depth)
        const taskItemEndPos = taskItemPos + taskNode.nodeSize
        
        // 删除任务节点
        editor
          .chain()
          .focus()
          .command(({ tr }: { tr: Transaction }) => {
            tr.delete(taskItemPos, taskItemEndPos)
            return true
          })
          .run()
        
        console.log('🗑️ 任务已删除:', taskTitle)
      }
    } catch (error) {
      console.error('❌ 删除任务失败:', error)
    }
    
    // 关闭菜单
    setShowTaskActionMenu(false)
  }, [editor, currentTaskElement])

  /**
   * 从当前点击的 DOM 节点定位到 ProseMirror 的 taskItem 节点位置
   * 关键：posAtDOM 拿到的通常不是 taskItem 的起始位置，必须向上找祖先节点。
   */
  const getTaskItemPos = useCallback((): { pos: number; node: ProseMirrorNode } | null => {
    if (!editor || !currentTaskElement) return null

    try {
      const domPos = editor.view.posAtDOM(currentTaskElement, 0)
      const $pos = editor.state.doc.resolve(domPos)

      for (let depth = $pos.depth; depth > 0; depth--) {
        const node = $pos.node(depth)
        if (node.type.name === 'taskItem') {
          return { pos: $pos.before(depth), node }
        }
      }
    } catch (e) {
      console.warn('⚠️ 无法定位 taskItem 节点位置:', e)
    }

    return null
  }, [editor, currentTaskElement])

  // 设置日期时间
  const handleSetDateTime = useCallback((value: DateTimeSetting) => {
    if (!editor || !currentTaskElement) return

    const taskInfo = getTaskItemPos()
    if (!taskInfo) {
      console.warn('⚠️ 设置时间失败：未找到 taskItem 节点')
      return
    }
    const taskPos = taskInfo.pos
    const taskNode = taskInfo.node
    
    if (value.mode === 'deadline') {
      // 截止时间模式
      const deadlineIso = value.time.toISOString()
      const formatted = formatDateTime(value.time)

      // ✅ 关键：同时把显示字符串写入 paragraph attrs（写进文档 JSON），避免仅写 DOM 被 ProseMirror 清掉
      editor
        .chain()
        .focus()
        .command(({ tr }: { tr: Transaction }) => {
          // 1) 写 taskItem attrs（用于解析/概览）
          tr.setNodeMarkup(taskPos, undefined, {
            ...taskNode.attrs,
            datetimeMode: 'deadline',
            deadlineTime: deadlineIso,
            intervalStart: null,
            intervalEnd: null,
          })

          // 2) 写 paragraph attrs（用于稳定显示）
          const paraPos = taskPos + 1
          const paraNode = tr.doc.nodeAt(paraPos)
          if (paraNode?.type.name === 'paragraph') {
            tr.setNodeMarkup(paraPos, undefined, {
              ...paraNode.attrs,
              datetimeDisplay: formatted,
            })
          }

          return true
        })
        .run()

      // DOM attribute 只作为兜底（不插入节点，不修改可编辑文本）
      currentTaskElement.setAttribute('data-datetime-mode', 'deadline')
      currentTaskElement.setAttribute('data-deadline-time', deadlineIso)
    } else {
      // 时间间隔模式
      const startIso = value.startTime.toISOString()
      const endIso = value.endTime.toISOString()
      const formatted = formatTimeInterval(value.startTime, value.endTime)

      editor
        .chain()
        .focus()
        .command(({ tr }: { tr: Transaction }) => {
          // 1) 写 taskItem attrs
          tr.setNodeMarkup(taskPos, undefined, {
            ...taskNode.attrs,
            datetimeMode: 'interval',
            deadlineTime: null,
            intervalStart: startIso,
            intervalEnd: endIso,
          })

          // 2) 写 paragraph attrs（用于稳定显示）
          const paraPos = taskPos + 1
          const paraNode = tr.doc.nodeAt(paraPos)
          if (paraNode?.type.name === 'paragraph') {
            tr.setNodeMarkup(paraPos, undefined, {
              ...paraNode.attrs,
              datetimeDisplay: formatted,
            })
          }

          return true
        })
        .run()
      
      // 更新显示：使用 data-datetime-display + CSS ::after（避免插入 DOM 节点引发 ProseMirror update 循环）
      currentTaskElement.setAttribute('data-datetime-mode', 'interval')
      currentTaskElement.setAttribute('data-interval-start', startIso)
      currentTaskElement.setAttribute('data-interval-end', endIso)
    }
    
    setShowDateTimePicker(false)
  }, [editor, currentTaskElement, getTaskItemPos])

  // 处理时长设置
  const handleSetDuration = useCallback((duration: number) => {
    if (!editor || !currentTaskElement) return

    const taskInfo = getTaskItemPos()
    if (!taskInfo) {
      console.warn('⚠️ 设置时长失败：未找到 taskItem 节点')
      return
    }
    const taskPos = taskInfo.pos
    const taskNode = taskInfo.node
    
    editor.chain()
      .focus()
      .command(({ tr }: { tr: Transaction }) => {
        tr.setNodeMarkup(taskPos, undefined, {
          ...taskNode.attrs,
          estimatedDuration: duration
        })
        return true
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
  }, [editor, currentTaskElement, getTaskItemPos])
  
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

  // 同步所有任务项的时间显示（不插 DOM 节点，只写 data-datetime-display 给 CSS 渲染）
  useEffect(() => {
    if (!editor) return

    const updateDateTimeDisplays = () => {
      // ⚠️ 检查编辑器视图是否已准备好
      if (!editor.view) {
        return
      }
      // ⚠️ 输入法(IME)组合输入期间不要操作 DOM，否则会触发 ProseMirror 的 DOM observer 导致内容重复
      if (editor.view.composing || isComposingRef.current) {
        return
      }
      const editorElement = editor.view.dom
      const taskItems = editorElement.querySelectorAll('li[data-drag-handle]')

      taskItems.forEach((item: Element) => {
        const contentDiv =
          (item.querySelector(':scope > div') as HTMLElement | null) ||
          (item.querySelector('div') as HTMLElement | null)

        if (!contentDiv) return

        // 清理历史遗留的 DOM 徽章（避免重复显示/触发 ProseMirror DOM observer 循环）
        contentDiv.querySelectorAll('.task-datetime-badge').forEach(el => el.remove())

        // 目标段落：CSS 使用 p[data-datetime-display]::after 显示
        const paragraphs = contentDiv.querySelectorAll('p')
        const targetP = paragraphs.length > 0 ? (paragraphs[0] as HTMLElement) : null
        if (!targetP) return

        // 如果任务没有时间模式，确保没有徽章
        const mode = item.getAttribute('data-datetime-mode')
        if (!mode) {
          targetP.removeAttribute('data-datetime-display')
          item.classList.remove('datetime-expired', 'datetime-active')
          return
        }

        let formatted = ''
        let color = ''
        const now = Date.now()

        if (mode === 'deadline') {
          const iso = item.getAttribute('data-deadline-time')
          if (!iso) {
            targetP.removeAttribute('data-datetime-display')
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          const deadline = new Date(iso)
          if (Number.isNaN(deadline.getTime())) {
            targetP.removeAttribute('data-datetime-display')
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          formatted = formatDateTime(deadline)
          const isExpired = deadline.getTime() < now
          color = isExpired ? '#dc2626' : '#f59e0b'
          item.classList.toggle('datetime-expired', isExpired)
          item.classList.remove('datetime-active')
        } else if (mode === 'interval') {
          const startIso = item.getAttribute('data-interval-start')
          const endIso = item.getAttribute('data-interval-end')

          if (!startIso || !endIso) {
            targetP.removeAttribute('data-datetime-display')
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          const startDate = new Date(startIso)
          const endDate = new Date(endIso)

          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            targetP.removeAttribute('data-datetime-display')
            item.classList.remove('datetime-expired', 'datetime-active')
            return
          }

          formatted = formatTimeInterval(startDate, endDate)

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

        if (!formatted) {
          targetP.removeAttribute('data-datetime-display')
          return
        }

        // 写入 data 属性，让 CSS ::after 渲染时间文本
        if (targetP.getAttribute('data-datetime-display') !== formatted) {
          targetP.setAttribute('data-datetime-display', formatted)
        }

        // 颜色交给 CSS（通过类），这里保留 color 变量不再写 style，避免 DOM 变化触发 observer
      })
    }

    const scheduleUpdate = () => {
      if (datetimeSyncScheduledRef.current) return
      datetimeSyncScheduledRef.current = true
      requestAnimationFrame(() => {
        datetimeSyncScheduledRef.current = false
        updateDateTimeDisplays()
      })
    }

    // 初始同步一次
    scheduleUpdate()

    const handler = () => scheduleUpdate()
    editor.on('update', handler)

    return () => {
      editor.off('update', handler)
    }
  }, [editor, datetimeSyncScheduledRef, isComposingRef])

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
          onDelete={handleDeleteTask}
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
type DebouncedFn<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFn<T> {
  let timeout: NodeJS.Timeout | null = null
  
  const debounced = function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  } as DebouncedFn<T>

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced
}


