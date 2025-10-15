/**
 * 操作推荐标签组件
 * 显示 AI 分析后的推荐操作，以 Badge 形式呈现
 */

'use client';

import React from 'react';

export interface ActionRecommendation {
  type: 'clarify' | 'decompose' | 'estimate' | 'prioritize' | 'checklist';
  label: string;
  icon: string;
  taskIds: string[];
  count: number;
  description: string;
}

interface ActionRecommendationsProps {
  /** 推荐操作列表 */
  recommendations: ActionRecommendation[];
  /** 点击推荐标签时的回调 */
  onActionClick: (type: string, taskIds: string[]) => void;
  /** 是否正在执行某个操作 */
  isExecuting?: boolean;
  /** 当前正在执行的操作类型 */
  executingType?: string;
}

/**
 * 操作推荐标签组件
 */
export const ActionRecommendations: React.FC<ActionRecommendationsProps> = ({
  recommendations,
  onActionClick,
  isExecuting = false,
  executingType,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500">AI 推荐操作</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recommendations.map((rec) => {
          const isCurrentlyExecuting = isExecuting && executingType === rec.type;
          const isDisabled = isExecuting && executingType !== rec.type;

          return (
            <button
              key={rec.type}
              onClick={() => !isExecuting && onActionClick(rec.type, rec.taskIds)}
              disabled={isDisabled}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 
                rounded-full text-sm font-medium
                transition-all duration-200
                ${
                  isCurrentlyExecuting
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 animate-pulse'
                    : isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                }
              `}
              title={rec.description}
            >
              <span className="text-base">{rec.icon}</span>
              <span>{rec.label}</span>
              {rec.count > 0 && (
                <span className={`
                  ml-0.5 px-1.5 py-0.5 rounded-full text-xs
                  ${isCurrentlyExecuting ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}
                `}>
                  {rec.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ActionRecommendations;



