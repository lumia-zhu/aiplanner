/**
 * 工具注册中心
 * 管理所有 AI 工具的注册、查询和执行
 */

import type {
  IAITool,
  ToolRegistryEntry,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolType,
} from '@/types/workflow/tool';

/**
 * 工具过滤条件
 */
export interface ToolFilter {
  /** 工具类型 */
  type?: ToolType;
  /** 工具名称 */
  name?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 最小优先级 */
  minPriority?: number;
  /** 标签 */
  tags?: string[];
}

/**
 * 工具注册中心类
 */
export class ToolRegistry {
  /** 工具注册表(按类型分组) */
  private tools: Map<string, ToolRegistryEntry> = new Map();

  /** 工具标签索引 */
  private tagIndex: Map<string, Set<string>> = new Map();

  /**
   * 注册工具
   * @param tool - 工具实例
   * @param tags - 工具标签(可选)
   */
  register(tool: IAITool, tags: string[] = []): void {
    const entry: ToolRegistryEntry = {
      tool,
      config: tool.config,
      statistics: tool.statistics,
      registeredAt: Date.now(),
      tags,
    };

    // 注册工具
    this.tools.set(tool.type, entry);

    // 更新标签索引
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(tool.type);
    }

    console.log(`✅ 工具已注册: ${tool.name} (${tool.type})`);
  }

  /**
   * 注销工具
   * @param toolType - 工具类型
   * @returns 是否成功注销
   */
  unregister(toolType: ToolType): boolean {
    const entry = this.tools.get(toolType);
    if (!entry) {
      return false;
    }

    // 从标签索引中移除
    for (const tag of entry.tags) {
      const typeSet = this.tagIndex.get(tag);
      if (typeSet) {
        typeSet.delete(toolType);
        if (typeSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // 从工具注册表中移除
    this.tools.delete(toolType);

    console.log(`🗑️ 工具已注销: ${entry.config.name} (${toolType})`);
    return true;
  }

  /**
   * 获取工具
   * @param toolType - 工具类型
   * @returns 工具实例,如果不存在则返回 undefined
   */
  getTool<TInput = any, TOutput = any>(toolType: ToolType): IAITool<TInput, TOutput> | undefined {
    const entry = this.tools.get(toolType);
    return entry?.tool as IAITool<TInput, TOutput> | undefined;
  }

  /**
   * 获取工具注册项
   * @param toolType - 工具类型
   * @returns 工具注册项,如果不存在则返回 undefined
   */
  getToolEntry(toolType: ToolType): ToolRegistryEntry | undefined {
    return this.tools.get(toolType);
  }

  /**
   * 检查工具是否已注册
   * @param toolType - 工具类型
   * @returns 是否已注册
   */
  hasTool(toolType: ToolType): boolean {
    return this.tools.has(toolType);
  }

  /**
   * 查询工具
   * @param filter - 过滤条件
   * @returns 符合条件的工具列表
   */
  query(filter: ToolFilter = {}): IAITool[] {
    let tools = Array.from(this.tools.values());

    // 按类型过滤
    if (filter.type) {
      tools = tools.filter((entry) => entry.config.type === filter.type);
    }

    // 按名称过滤
    if (filter.name) {
      const namePattern = new RegExp(filter.name, 'i');
      tools = tools.filter((entry) => namePattern.test(entry.config.name));
    }

    // 按启用状态过滤
    if (filter.enabled !== undefined) {
      tools = tools.filter((entry) => entry.tool.enabled === filter.enabled);
    }

    // 按优先级过滤
    if (filter.minPriority !== undefined) {
      tools = tools.filter((entry) => (entry.config.priority ?? 0) >= filter.minPriority!);
    }

    // 按标签过滤
    if (filter.tags && filter.tags.length > 0) {
      tools = tools.filter((entry) => filter.tags!.some((tag) => entry.tags.includes(tag)));
    }

    return tools.map((entry) => entry.tool);
  }

  /**
   * 执行工具
   * @param toolType - 工具类型
   * @param input - 输入数据
   * @param context - 执行上下文
   * @returns 执行结果
   */
  async execute<TInput = any, TOutput = any>(
    toolType: ToolType,
    input: TInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<TOutput>> {
    const tool = this.getTool<TInput, TOutput>(toolType);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolType}`,
        executionTime: 0,
        toolType,
      };
    }

    return tool.execute(input, context);
  }

  /**
   * 批量执行工具
   * @param executions - 工具执行列表
   * @returns 执行结果列表
   */
  async batchExecute(
    executions: Array<{
      toolType: ToolType;
      input: any;
      context: ToolExecutionContext;
    }>
  ): Promise<ToolExecutionResult<any>[]> {
    return Promise.all(executions.map((exec) => this.execute(exec.toolType, exec.input, exec.context)));
  }

  /**
   * 获取所有工具类型
   * @returns 工具类型列表
   */
  getAllToolTypes(): ToolType[] {
    return Array.from(this.tools.keys()) as ToolType[];
  }

  /**
   * 获取所有工具
   * @returns 工具实例列表
   */
  getAllTools(): IAITool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * 获取所有工具注册项
   * @returns 工具注册项列表
   */
  getAllEntries(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取按标签分组的工具
   * @returns 按标签分组的工具类型映射
   */
  getToolsByTag(): Map<string, ToolType[]> {
    const result = new Map<string, ToolType[]>();
    for (const [tag, types] of this.tagIndex.entries()) {
      result.set(tag, Array.from(types) as ToolType[]);
    }
    return result;
  }

  /**
   * 获取所有标签
   * @returns 标签列表
   */
  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * 启用工具
   * @param toolType - 工具类型
   * @returns 是否成功
   */
  enableTool(toolType: ToolType): boolean {
    const tool = this.getTool(toolType);
    if (!tool) {
      return false;
    }
    tool.enabled = true;
    return true;
  }

  /**
   * 禁用工具
   * @param toolType - 工具类型
   * @returns 是否成功
   */
  disableTool(toolType: ToolType): boolean {
    const tool = this.getTool(toolType);
    if (!tool) {
      return false;
    }
    tool.enabled = false;
    return true;
  }

  /**
   * 重置所有工具的统计信息
   */
  resetAllStatistics(): void {
    for (const entry of this.tools.values()) {
      entry.tool.resetStatistics();
    }
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.tools.clear();
    this.tagIndex.clear();
  }

  /**
   * 获取注册中心统计信息
   */
  getRegistryStats(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    tags: string[];
  } {
    const entries = Array.from(this.tools.values());

    return {
      totalTools: entries.length,
      enabledTools: entries.filter((e) => e.tool.enabled).length,
      disabledTools: entries.filter((e) => !e.tool.enabled).length,
      totalExecutions: entries.reduce((sum, e) => sum + e.statistics.totalExecutions, 0),
      successfulExecutions: entries.reduce((sum, e) => sum + e.statistics.successfulExecutions, 0),
      failedExecutions: entries.reduce((sum, e) => sum + e.statistics.failedExecutions, 0),
      tags: Array.from(this.tagIndex.keys()),
    };
  }
}

/**
 * 全局工具注册中心实例
 */
export const globalToolRegistry = new ToolRegistry();

