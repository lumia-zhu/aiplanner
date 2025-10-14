/**
 * 真实 AI 工作流 Hook
 * 连接到真实的 WorkflowOrchestrator
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowPhase, SuggestionChip } from '@/types/workflow';
import type { WorkflowProgress } from './useAIWorkflow';
import { initializeWorkflow, hasApiKey } from '@/lib/workflow/init';

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface UseRealWorkflowReturn {
  status: WorkflowStatus;
  progress: WorkflowProgress | null;
  suggestions: SuggestionChip[];
  streamingMessage: string;
  error: string | null;
  startWorkflow: (tasks: any[], userId: string) => Promise<void>;
  pauseWorkflow: () => void;
  resumeWorkflow: () => void;
  stopWorkflow: () => void;
  acceptSuggestion: (chipId: string) => void;
  rejectSuggestion: (chipId: string) => void;
  clearSuggestions: () => void;
}

/**
 * 真实 AI 工作流 Hook
 */
export function useRealWorkflow(): UseRealWorkflowReturn {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionChip[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orchestratorRef = useRef<ReturnType<typeof initializeWorkflow> | null>(null);

  /**
   * 开始执行真实工作流
   */
  const startWorkflow = useCallback(async (tasks: any[], userId: string) => {
    if (status === 'running') {
      console.warn('工作流已在运行中');
      return;
    }

    // 检查 API 密钥
    if (!hasApiKey()) {
      setError('未配置 DOUBAO_API_KEY,无法启动真实工作流');
      setStatus('error');
      return;
    }

    console.log('🚀 开始真实 AI 工作流...');
    setStatus('running');
    setError(null);
    setSuggestions([]);
    setStreamingMessage('');

    try {
      // 初始化工作流编排器
      if (!orchestratorRef.current) {
        orchestratorRef.current = initializeWorkflow();
      }

      const orchestrator = orchestratorRef.current;

      // 监听上下文变化
      const contextManager = orchestrator.getContextManager();
      
      // 添加监听器
      contextManager.addListener((context) => {
        // 更新建议
        setSuggestions(context.suggestions || []);
        
        // 更新进度
        const phaseMap: Record<string, number> = {
          'analyzing': 0,
          'clarifying': 1,
          'decomposing': 2,
          'estimating': 3,
          'prioritizing': 4,
          'checking': 5,
          'completed': 6,
        };

        const currentPhaseIndex = phaseMap[context.currentPhase] || 0;
        const totalSteps = 6;

        setProgress({
          currentPhase: context.currentPhase,
          currentStep: getPhaseText(context.currentPhase),
          totalSteps,
          completedSteps: currentPhaseIndex,
          progress: (currentPhaseIndex / totalSteps) * 100,
        });

        // 更新流式消息
        setStreamingMessage(`正在${getPhaseText(context.currentPhase)}...`);
      });

      // 执行工作流
      const result = await orchestrator.execute({
        userId,
        tasks,
        autoExecute: true,
      });

      if (result.success) {
        setStatus('completed');
        setStreamingMessage('');
        console.log('✅ 工作流执行完成');
      } else {
        setStatus('error');
        setError(result.error || '工作流执行失败');
        console.error('❌ 工作流执行失败:', result.error);
      }
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('❌ 工作流执行异常:', err);
    }
  }, [status]);

  /**
   * 暂停工作流
   */
  const pauseWorkflow = useCallback(() => {
    console.log('⏸️ 暂停功能暂未实现');
  }, []);

  /**
   * 恢复工作流
   */
  const resumeWorkflow = useCallback(() => {
    console.log('▶️ 恢复功能暂未实现');
  }, []);

  /**
   * 停止工作流
   */
  const stopWorkflow = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.reset();
      setStatus('idle');
      setProgress(null);
      setStreamingMessage('');
      console.log('⏹️ 工作流已停止');
    }
  }, []);

  /**
   * 接受建议
   */
  const acceptSuggestion = useCallback((chipId: string) => {
    setSuggestions((prev) => prev.filter((chip) => chip.id !== chipId));
    console.log(`✅ 接受建议: ${chipId}`);
  }, []);

  /**
   * 拒绝建议
   */
  const rejectSuggestion = useCallback((chipId: string) => {
    setSuggestions((prev) => prev.filter((chip) => chip.id !== chipId));
    console.log(`❌ 拒绝建议: ${chipId}`);
  }, []);

  /**
   * 清空所有建议
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    console.log('🗑️ 已清空所有建议');
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.reset();
      }
    };
  }, []);

  return {
    status,
    progress,
    suggestions,
    streamingMessage,
    error,
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    stopWorkflow,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestions,
  };
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

