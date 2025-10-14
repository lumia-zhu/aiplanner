/**
 * AI 工作流 Hook
 * 管理 AI 工作流的执行和状态
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowPhase, SuggestionChip } from '@/types/workflow';

/**
 * 工作流执行状态
 */
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * 工作流执行进度
 */
export interface WorkflowProgress {
  currentPhase: WorkflowPhase;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  progress: number; // 0-100
}

/**
 * Hook 返回值
 */
export interface UseAIWorkflowReturn {
  // 状态
  status: WorkflowStatus;
  progress: WorkflowProgress | null;
  suggestions: SuggestionChip[];
  streamingMessage: string;
  error: string | null;

  // 方法
  startWorkflow: (tasks: any[], userId: string) => Promise<void>;
  pauseWorkflow: () => void;
  resumeWorkflow: () => void;
  stopWorkflow: () => void;
  acceptSuggestion: (chipId: string) => void;
  rejectSuggestion: (chipId: string) => void;
  clearSuggestions: () => void;
}

/**
 * 模拟的工作流执行器(临时实现)
 * 在 Dashboard 集成时会替换为真实的 WorkflowOrchestrator
 */
class MockWorkflowExecutor {
  private onProgress?: (progress: WorkflowProgress) => void;
  private onSuggestion?: (chip: SuggestionChip) => void;
  private onMessage?: (message: string) => void;
  private onComplete?: () => void;
  private onError?: (error: string) => void;
  private isPaused: boolean = false;
  private isStopped: boolean = false;

  constructor(callbacks: {
    onProgress?: (progress: WorkflowProgress) => void;
    onSuggestion?: (chip: SuggestionChip) => void;
    onMessage?: (message: string) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
  }) {
    this.onProgress = callbacks.onProgress;
    this.onSuggestion = callbacks.onSuggestion;
    this.onMessage = callbacks.onMessage;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;
  }

  async execute(tasks: any[], userId: string): Promise<void> {
    try {
      const phases: Array<{ phase: WorkflowPhase; step: string }> = [
        { phase: 'analyzing', step: '分析任务复杂度' },
        { phase: 'clarifying', step: '生成澄清问题' },
        { phase: 'decomposing', step: '拆解任务' },
        { phase: 'estimating', step: '估算时间' },
        { phase: 'prioritizing', step: '排序优先级' },
        { phase: 'checking', step: '生成检查清单' },
      ];

      const totalSteps = phases.length;

      for (let i = 0; i < phases.length; i++) {
        if (this.isStopped) break;

        // 等待暂停恢复
        while (this.isPaused && !this.isStopped) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const { phase, step } = phases[i];

        // 更新进度
        this.onProgress?.({
          currentPhase: phase,
          currentStep: step,
          totalSteps,
          completedSteps: i,
          progress: (i / totalSteps) * 100,
        });

        // 模拟流式消息
        const messages = [
          `正在${step}...`,
          `分析任务: ${tasks[0]?.title || '未知任务'}`,
          `${step}完成`,
        ];

        for (const msg of messages) {
          if (this.isStopped) break;
          this.onMessage?.(msg);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // 生成建议芯片
        if (i < 3) {
          // 前3个步骤生成建议
          this.onSuggestion?.({
            id: `chip-${Date.now()}-${i}`,
            text: `建议: ${step}结果`,
            action: 'info',
            metadata: { phase, step },
          });
        }

        // 模拟处理时间
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // 最终进度
      if (!this.isStopped) {
        this.onProgress?.({
          currentPhase: 'completed',
          currentStep: '完成',
          totalSteps,
          completedSteps: totalSteps,
          progress: 100,
        });

        this.onComplete?.();
      }
    } catch (error) {
      this.onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  stop(): void {
    this.isStopped = true;
  }
}

/**
 * AI 工作流 Hook
 */
export function useAIWorkflow(): UseAIWorkflowReturn {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionChip[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const executorRef = useRef<MockWorkflowExecutor | null>(null);

  /**
   * 开始执行工作流
   */
  const startWorkflow = useCallback(async (tasks: any[], userId: string) => {
    if (status === 'running') {
      console.warn('工作流已在运行中');
      return;
    }

    console.log('🚀 开始 AI 工作流...');
    setStatus('running');
    setError(null);
    setSuggestions([]);
    setStreamingMessage('');

    // 创建执行器
    executorRef.current = new MockWorkflowExecutor({
      onProgress: (prog) => {
        setProgress(prog);
        console.log(`📍 进度: ${prog.currentStep} (${prog.progress.toFixed(0)}%)`);
      },
      onSuggestion: (chip) => {
        setSuggestions((prev) => [...prev, chip]);
        console.log(`💡 新建议: ${chip.text}`);
      },
      onMessage: (msg) => {
        setStreamingMessage((prev) => (prev ? `${prev}\n${msg}` : msg));
      },
      onComplete: () => {
        setStatus('completed');
        setStreamingMessage('');
        console.log('✅ 工作流完成');
      },
      onError: (err) => {
        setStatus('error');
        setError(err);
        console.error('❌ 工作流错误:', err);
      },
    });

    // 执行工作流
    await executorRef.current.execute(tasks, userId);
  }, [status]);

  /**
   * 暂停工作流
   */
  const pauseWorkflow = useCallback(() => {
    if (executorRef.current && status === 'running') {
      executorRef.current.pause();
      setStatus('paused');
      console.log('⏸️ 工作流已暂停');
    }
  }, [status]);

  /**
   * 恢复工作流
   */
  const resumeWorkflow = useCallback(() => {
    if (executorRef.current && status === 'paused') {
      executorRef.current.resume();
      setStatus('running');
      console.log('▶️ 工作流已恢复');
    }
  }, [status]);

  /**
   * 停止工作流
   */
  const stopWorkflow = useCallback(() => {
    if (executorRef.current && (status === 'running' || status === 'paused')) {
      executorRef.current.stop();
      setStatus('idle');
      setProgress(null);
      setStreamingMessage('');
      console.log('⏹️ 工作流已停止');
    }
  }, [status]);

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
      if (executorRef.current) {
        executorRef.current.stop();
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

