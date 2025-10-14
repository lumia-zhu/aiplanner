/**
 * 建议芯片组件
 * 显示 AI 生成的建议芯片,用户可以点击接受或拒绝
 */

'use client';

import React from 'react';
import type { SuggestionChip } from '@/types/workflow';

interface SuggestionChipsProps {
  /** 建议芯片列表 */
  chips: SuggestionChip[];
  /** 接受建议回调 */
  onAccept: (chipId: string) => void;
  /** 拒绝建议回调 */
  onReject: (chipId: string) => void;
  /** 是否禁用交互 */
  disabled?: boolean;
}

/**
 * 根据 action 获取芯片样式
 */
function getChipStyle(action: string): string {
  switch (action) {
    case 'clarify':
      return 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100';
    case 'add_subtask':
      return 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100';
    case 'update_time':
      return 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100';
    case 'set_priority':
      return 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100';
    case 'add_checklist':
      return 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100';
  }
}

/**
 * 根据 action 获取图标
 */
function getChipIcon(action: string): string {
  switch (action) {
    case 'clarify':
      return '❓';
    case 'add_subtask':
      return '➕';
    case 'update_time':
      return '⏱️';
    case 'set_priority':
      return '🎯';
    case 'add_checklist':
      return '✅';
    default:
      return '💡';
  }
}

/**
 * 建议芯片组件
 */
export default function SuggestionChips({
  chips,
  onAccept,
  onReject,
  disabled = false,
}: SuggestionChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          AI 建议 ({chips.length})
        </h3>
        <button
          onClick={() => chips.forEach((chip) => onReject(chip.id))}
          disabled={disabled}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          全部忽略
        </button>
      </div>

      {/* 芯片列表 */}
      <div className="space-y-2">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className={`
              group relative flex items-center justify-between gap-2 
              p-3 rounded-lg border transition-all
              ${getChipStyle(chip.action)}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* 左侧:图标 + 文本 */}
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-lg shrink-0 mt-0.5">
                {getChipIcon(chip.action)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-words">
                  {chip.text}
                </p>
                {chip.category && (
                  <p className="text-xs opacity-70 mt-1">
                    分类: {chip.category}
                  </p>
                )}
              </div>
            </div>

            {/* 右侧:操作按钮 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept(chip.id);
                }}
                disabled={disabled}
                className="
                  px-2 py-1 text-xs font-medium rounded
                  bg-white/80 hover:bg-white
                  border border-current
                  transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                title="接受建议"
              >
                ✓
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(chip.id);
                }}
                disabled={disabled}
                className="
                  px-2 py-1 text-xs font-medium rounded
                  bg-white/80 hover:bg-white
                  border border-current
                  transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                title="拒绝建议"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

