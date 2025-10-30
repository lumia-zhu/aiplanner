/**
 * TaskTag - Tiptap Mark 扩展
 * 用于为任务添加彩色标签（Notion 风格）
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export interface TaskTagOptions {
  HTMLAttributes: Record<string, any>
}

export interface TaskTagAttributes {
  label: string    // 标签名称
  color: string    // 标签颜色
  emoji: string    // 标签图标
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskTag: {
      /**
       * 设置任务标签
       */
      setTaskTag: (attributes: TaskTagAttributes) => ReturnType
      /**
       * 取消任务标签
       */
      unsetTaskTag: () => ReturnType
    }
  }
}

export const TaskTag = Mark.create<TaskTagOptions>({
  name: 'taskTag',
  
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },
  
  addAttributes() {
    return {
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) {
            return {}
          }
          return {
            'data-label': attributes.label,
          }
        },
      },
      color: {
        default: '#3B82F6',
        parseHTML: element => element.getAttribute('data-color'),
        renderHTML: attributes => {
          if (!attributes.color) {
            return {}
          }
          return {
            'data-color': attributes.color,
          }
        },
      },
      emoji: {
        default: '🏷️',
        parseHTML: element => element.getAttribute('data-emoji'),
        renderHTML: attributes => {
          if (!attributes.emoji) {
            return {}
          }
          return {
            'data-emoji': attributes.emoji,
          }
        },
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-task-tag]',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-task-tag': '',
        class: 'task-tag-mark',
        // 用 CSS 变量传递颜色，让 CSS 控制样式
        style: `--tag-color: ${HTMLAttributes['data-color']};`,
      }),
      // 只显示标签名，不显示 emoji（# 符号由 CSS ::before 自动添加）
      HTMLAttributes['data-label'],
    ]
  },
  
  addCommands() {
    return {
      setTaskTag: (attributes: TaskTagAttributes) => ({ commands }) => {
        return commands.setMark(this.name, attributes)
      },
      unsetTaskTag: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },
})

