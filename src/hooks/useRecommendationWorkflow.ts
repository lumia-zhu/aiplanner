/**
 * 推荐工作流 Hook
 * 只执行分析阶段，返回推荐操作标签，用户按需选择执行
 */

import { useState, useCallback, useRef } from 'react';
import { initializeWorkflow, hasApiKey } from '@/lib/workflow/init';

export interface ActionRecommendation {
  type: 'clarify' | 'decompose' | 'estimate' | 'prioritize' | 'checklist';
  label: string;
  icon: string;
  taskIds: string[];
  count: number;
  description: string;
}

export interface UseRecommendationWorkflowReturn {
  /** 当前状态 */
  status: 'idle' | 'analyzing' | 'ready' | 'executing' | 'error';
  /** 推荐操作列表 */
  recommendations: ActionRecommendation[];
  /** 正在执行的操作类型 */
  executingAction: string | null;
  /** 错误信息 */
  error: string | null;
  /** 执行结果数据 */
  executionResult: any | null;
  /** 开始分析（生成推荐标签） */
  analyze: (tasks: any[], userId: string) => Promise<void>;
  /** 执行某个推荐操作 */
  executeAction: (actionType: string, taskIds?: string[]) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 推荐工作流 Hook
 */
export function useRecommendationWorkflow(): UseRecommendationWorkflowReturn {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'ready' | 'executing' | 'error'>('idle');
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  const orchestratorRef = useRef<ReturnType<typeof initializeWorkflow> | null>(null);

  /**
   * 本地启发式：无需请求 AI，立即给出推荐
   */
  function buildHeuristicRecommendations(tasks: any[]): ActionRecommendation[] {
    const clarifyIds: string[] = [];
    const decomposeIds: string[] = [];
    const estimateIds: string[] = [];
    const allIds: string[] = [];

    for (const t of tasks) {
      const id = t.id || `task-${Math.random().toString(36).slice(2)}`;
      allIds.push(id);
      const title: string = t.title || '';
      const description: string = t.description || '';

      // 澄清：无描述或过短
      if (!description || description.trim().length < 8) {
        clarifyIds.push(id);
      }

      // 拆解：标题过长或包含并列词（粗略判断）
      if (title.length > 24 || /且|并且|以及|同时|and|,/.test(title)) {
        decomposeIds.push(id);
      }

      // 估时：无 duration 字段
      if (!('duration' in t) || !t.duration) {
        estimateIds.push(id);
      }
    }

    const recs: ActionRecommendation[] = [];
    if (clarifyIds.length)
      recs.push({ type: 'clarify', label: '澄清任务', icon: '🔍', taskIds: clarifyIds, count: clarifyIds.length, description: `${clarifyIds.length} 个任务描述不清` });
    if (decomposeIds.length)
      recs.push({ type: 'decompose', label: '拆解任务', icon: '🔨', taskIds: decomposeIds, count: decomposeIds.length, description: `${decomposeIds.length} 个任务可拆解` });
    if (estimateIds.length)
      recs.push({ type: 'estimate', label: '估算时间', icon: '⏱️', taskIds: estimateIds, count: estimateIds.length, description: `${estimateIds.length} 个任务需估时` });
    // 优先级与检查清单始终可用
    recs.push({ type: 'prioritize', label: '优先级建议', icon: '🎯', taskIds: allIds, count: allIds.length, description: `为 ${allIds.length} 个任务推荐优先级` });
    recs.push({ type: 'checklist', label: '检查清单', icon: '✅', taskIds: allIds, count: allIds.length, description: `为任务生成检查清单` });

    // 排序：澄清 > 拆解 > 估时 > 优先级 > 清单
    const order: Record<string, number> = { clarify: 1, decompose: 2, estimate: 3, prioritize: 4, checklist: 5 };
    return recs.sort((a, b) => (order[a.type] || 99) - (order[b.type] || 99));
  }

  /**
   * 开始分析任务：立即显示本地推荐（不等待 AI）
   */
  const analyze = useCallback(async (tasks: any[], userId: string) => {
    if (status === 'analyzing' || status === 'executing') {
      console.warn('当前正在执行中，请稍后');
      return;
    }

    // 立即给出本地推荐
    const localRecs = buildHeuristicRecommendations(tasks);
    setRecommendations(localRecs);
    setStatus('ready');
    setError(null);
    setExecutionResult(null);

    // 可选：后续若需要用 AI 优化推荐，可在后台刷新（当前按你的要求不请求 AI）
  }, [status]);

  /**
   * 执行某个推荐操作
   */
  const executeAction = useCallback(async (actionType: string, taskIds?: string[]) => {
    if (status === 'executing') {
      console.warn('当前正在执行中，请稍后');
      return;
    }

    if (!orchestratorRef.current) {
      setError('工作流未初始化');
      setStatus('error');
      return;
    }

    console.log(`🎯 开始执行操作: ${actionType}`);
    setStatus('executing');
    setExecutingAction(actionType);
    setError(null);
    setExecutionResult(null);

    try {
      const orchestrator = orchestratorRef.current;

      // 调用 executeAction 方法
      const result = await orchestrator.executeAction(
        actionType as any,
        taskIds
      );

      if (result.success && result.data) {
        setExecutionResult(result.data);
        setStatus('ready');
        
        // 移除已执行的推荐（如果全部任务都处理了）
        setRecommendations((prev) => 
          prev.map(rec => 
            rec.type === actionType 
              ? { ...rec, count: 0 } // 标记为已完成
              : rec
          ).filter(rec => rec.count > 0) // 移除已完成的推荐
        );

        console.log(`✅ 操作完成: ${actionType}`);
      } else {
        setStatus('error');
        setError(result.error || '执行失败');
        console.error('❌ 执行失败:', result.error);
      }
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('❌ 执行异常:', err);
    } finally {
      setExecutingAction(null);
    }
  }, [status]);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.reset();
    }
    setStatus('idle');
    setRecommendations([]);
    setExecutingAction(null);
    setError(null);
    setExecutionResult(null);
    console.log('🔄 工作流已重置');
  }, []);

  return {
    status,
    recommendations,
    executingAction,
    error,
    executionResult,
    analyze,
    executeAction,
    reset,
  };
}

