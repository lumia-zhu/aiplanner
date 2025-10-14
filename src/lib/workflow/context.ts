/**
 * 工作流上下文管理器
 * 管理工作流执行过程中的状态和数据
 */

import type {
  WorkflowContext,
  WorkflowPhase,
  TaskAnalysis,
  SuggestionChip,
  PlanVersion,
} from '@/types/workflow';

/**
 * 工作流上下文管理器类
 */
export class WorkflowContextManager {
  /** 当前上下文 */
  private context: WorkflowContext;

  /** 状态变更监听器 */
  private listeners: Set<(context: WorkflowContext) => void> = new Set();

  /**
   * 构造函数
   * @param initialContext - 初始上下文
   */
  constructor(initialContext: Partial<WorkflowContext> = {}) {
    this.context = {
      userId: initialContext.userId || '',
      sessionId: initialContext.sessionId || this.generateSessionId(),
      currentPhase: initialContext.currentPhase || 'initial',
      tasks: initialContext.tasks || [],
      analysis: initialContext.analysis,
      suggestions: initialContext.suggestions || [],
      planVersions: initialContext.planVersions || [],
      metadata: initialContext.metadata || {},
      timestamp: Date.now(),
    };
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取当前上下文
   */
  getContext(): WorkflowContext {
    return { ...this.context };
  }

  /**
   * 更新上下文
   * @param updates - 要更新的字段
   */
  updateContext(updates: Partial<WorkflowContext>): void {
    this.context = {
      ...this.context,
      ...updates,
      timestamp: Date.now(),
    };

    this.notifyListeners();
  }

  /**
   * 设置当前阶段
   * @param phase - 工作流阶段
   */
  setPhase(phase: WorkflowPhase): void {
    this.updateContext({ currentPhase: phase });
    console.log(`🔄 工作流阶段切换: ${phase}`);
  }

  /**
   * 获取当前阶段
   */
  getPhase(): WorkflowPhase {
    return this.context.currentPhase;
  }

  /**
   * 设置任务列表
   * @param tasks - 任务列表
   */
  setTasks(tasks: any[]): void {
    this.updateContext({ tasks });
  }

  /**
   * 获取任务列表
   */
  getTasks(): any[] {
    return this.context.tasks;
  }

  /**
   * 设置任务分析结果
   * @param analysis - 任务分析
   */
  setAnalysis(analysis: TaskAnalysis): void {
    this.updateContext({ analysis });
  }

  /**
   * 获取任务分析结果
   */
  getAnalysis(): TaskAnalysis | undefined {
    return this.context.analysis;
  }

  /**
   * 添加建议芯片
   * @param chip - 建议芯片
   */
  addSuggestion(chip: SuggestionChip): void {
    const suggestions = [...this.context.suggestions, chip];
    this.updateContext({ suggestions });
  }

  /**
   * 批量添加建议芯片
   * @param chips - 建议芯片列表
   */
  addSuggestions(chips: SuggestionChip[]): void {
    const suggestions = [...this.context.suggestions, ...chips];
    this.updateContext({ suggestions });
  }

  /**
   * 移除建议芯片
   * @param chipId - 芯片 ID
   */
  removeSuggestion(chipId: string): void {
    const suggestions = this.context.suggestions.filter((c) => c.id !== chipId);
    this.updateContext({ suggestions });
  }

  /**
   * 清空建议芯片
   */
  clearSuggestions(): void {
    this.updateContext({ suggestions: [] });
  }

  /**
   * 获取建议芯片
   */
  getSuggestions(): SuggestionChip[] {
    return this.context.suggestions;
  }

  /**
   * 添加计划版本
   * @param version - 计划版本
   */
  addPlanVersion(version: PlanVersion): void {
    const planVersions = [...this.context.planVersions, version];
    this.updateContext({ planVersions });
  }

  /**
   * 获取计划版本历史
   */
  getPlanVersions(): PlanVersion[] {
    return this.context.planVersions;
  }

  /**
   * 获取最新计划版本
   */
  getLatestPlanVersion(): PlanVersion | undefined {
    if (this.context.planVersions.length === 0) {
      return undefined;
    }
    return this.context.planVersions[this.context.planVersions.length - 1];
  }

  /**
   * 设置元数据
   * @param key - 键
   * @param value - 值
   */
  setMetadata(key: string, value: any): void {
    const metadata = {
      ...this.context.metadata,
      [key]: value,
    };
    this.updateContext({ metadata });
  }

  /**
   * 获取元数据
   * @param key - 键
   * @returns 值
   */
  getMetadata(key: string): any {
    return this.context.metadata[key];
  }

  /**
   * 删除元数据
   * @param key - 键
   */
  deleteMetadata(key: string): void {
    const metadata = { ...this.context.metadata };
    delete metadata[key];
    this.updateContext({ metadata });
  }

  /**
   * 注册状态变更监听器
   * @param listener - 监听器函数
   */
  addListener(listener: (context: WorkflowContext) => void): void {
    this.listeners.add(listener);
  }

  /**
   * 注销状态变更监听器
   * @param listener - 监听器函数
   */
  removeListener(listener: (context: WorkflowContext) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getContext());
      } catch (error) {
        console.error('监听器执行失败:', error);
      }
    });
  }

  /**
   * 重置上下文
   * @param keepUserId - 是否保留用户 ID
   */
  reset(keepUserId: boolean = true): void {
    const userId = keepUserId ? this.context.userId : '';
    this.context = {
      userId,
      sessionId: this.generateSessionId(),
      currentPhase: 'initial',
      tasks: [],
      suggestions: [],
      planVersions: [],
      metadata: {},
      timestamp: Date.now(),
    };

    this.notifyListeners();
  }

  /**
   * 导出上下文为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.context, null, 2);
  }

  /**
   * 从 JSON 恢复上下文
   * @param json - JSON 字符串
   */
  fromJSON(json: string): void {
    try {
      const context = JSON.parse(json);
      this.context = context;
      this.notifyListeners();
    } catch (error) {
      console.error('从 JSON 恢复上下文失败:', error);
      throw new Error('Invalid context JSON');
    }
  }

  /**
   * 获取上下文摘要(用于调试)
   */
  getSummary(): {
    sessionId: string;
    currentPhase: WorkflowPhase;
    taskCount: number;
    hasAnalysis: boolean;
    suggestionCount: number;
    planVersionCount: number;
  } {
    return {
      sessionId: this.context.sessionId,
      currentPhase: this.context.currentPhase,
      taskCount: this.context.tasks.length,
      hasAnalysis: !!this.context.analysis,
      suggestionCount: this.context.suggestions.length,
      planVersionCount: this.context.planVersions.length,
    };
  }
}

