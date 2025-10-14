/**
 * 工作流进度组件
 * 显示 AI 工作流的执行进度
 */

'use client';

import React from 'react';
import type { WorkflowProgress } from '@/hooks/useAIWorkflow';

interface WorkflowProgressProps {
  /** 进度数据 */
  progress: WorkflowProgress | null;
  /** 是否显示详细信息 */
  showDetails?: boolean;
}

/**
 * 根据阶段获取显示文本
 */
function getPhaseText(phase: string): string {
  const phaseMap: Record<string, string> = {
    initial: '初始化',
    analyzing: '分析任务',
    clarifying: '澄清需求',
    decomposing: '拆解任务',
    estimating: '估算时间',
    prioritizing: '排序优先级',
    checking: '生成检查清单',
    completed: '完成',
  };
  return phaseMap[phase] || phase;
}

/**
 * 根据阶段获取颜色
 */
function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'analyzing':
      return 'bg-blue-500';
    case 'clarifying':
      return 'bg-purple-500';
    case 'decomposing':
      return 'bg-green-500';
    case 'estimating':
      return 'bg-yellow-500';
    case 'prioritizing':
      return 'bg-orange-500';
    case 'checking':
      return 'bg-red-500';
    case 'completed':
      return 'bg-gray-500';
    default:
      return 'bg-blue-500';
  }
}

/**
 * 工作流进度组件
 */
export default function WorkflowProgress({
  progress,
  showDetails = true,
}: WorkflowProgressProps) {
  if (!progress) {
    return null;
  }

  const { currentPhase, currentStep, totalSteps, completedSteps, progress: percentage } = progress;

  return (
    <div className="space-y-3">
      {/* 当前步骤 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getPhaseColor(currentPhase)} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700">
            {getPhaseText(currentPhase)}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {completedSteps}/{totalSteps}
        </span>
      </div>

      {/* 进度条 */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${getPhaseColor(currentPhase)} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 详细信息 */}
      {showDetails && (
        <div className="text-xs text-gray-600 space-y-1">
          <p>当前步骤: {currentStep}</p>
          <p>进度: {percentage.toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

