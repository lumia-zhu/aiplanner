/**
 * AI 工具基类
 * 提供所有 AI 工具的通用功能和接口
 */

import type {
  IAITool,
  AIToolConfig,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolStatistics,
} from '@/types/workflow/tool';
import type { AIService } from '@/lib/ai/service';

/**
 * AI 工具抽象基类
 * 所有具体工具都应继承此类
 */
export abstract class AITool<TInput = any, TOutput = any> implements IAITool<TInput, TOutput> {
  /** 工具配置 */
  public readonly config: AIToolConfig;

  /** 工具统计信息 */
  public readonly statistics: ToolStatistics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0,
    lastError: undefined,
  };

  /** AI 服务实例 */
  protected aiService: AIService;

  /** 是否启用 */
  private _enabled: boolean;

  /**
   * 构造函数
   * @param config - 工具配置
   * @param aiService - AI 服务实例
   */
  constructor(config: AIToolConfig, aiService: AIService) {
    this.config = config;
    this.aiService = aiService;
    this._enabled = config.enabled !== false;
  }

  /**
   * 获取工具类型
   */
  get type(): string {
    return this.config.type;
  }

  /**
   * 获取工具名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 获取工具描述
   */
  get description(): string {
    return this.config.description;
  }

  /**
   * 获取工具是否启用
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 设置工具是否启用
   */
  set enabled(value: boolean) {
    this._enabled = value;
  }

  /**
   * 执行工具
   * @param input - 输入数据
   * @param context - 执行上下文
   * @returns 执行结果
   */
  async execute(input: TInput, context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>> {
    // 检查工具是否启用
    if (!this._enabled) {
      return {
        success: false,
        error: `Tool ${this.name} is disabled`,
        executionTime: 0,
        toolType: this.config.type as any,
      };
    }

    const startTime = Date.now();

    try {
      // 执行前验证
      const validationError = await this.validate(input, context);
      if (validationError) {
        this.updateStatistics(false, Date.now() - startTime, validationError);
        return {
          success: false,
          error: validationError,
          executionTime: Date.now() - startTime,
          toolType: this.config.type as any,
        };
      }

      // 执行前钩子
      await this.beforeExecute(input, context);

      // 执行具体逻辑
      const result = await this.executeInternal(input, context);

      // 执行后钩子
      await this.afterExecute(result, context);

      // 更新统计信息
      const executionTime = Date.now() - startTime;
      this.updateStatistics(true, executionTime);

      return {
        ...result,
        success: true,
        executionTime,
        toolType: this.config.type as any,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.updateStatistics(false, executionTime, errorMessage);

      return {
        success: false,
        error: errorMessage,
        executionTime,
        toolType: this.config.type as any,
      };
    }
  }

  /**
   * 验证输入数据
   * @param input - 输入数据
   * @param context - 执行上下文
   * @returns 错误信息,如果验证通过则返回 undefined
   */
  protected async validate(input: TInput, context: ToolExecutionContext): Promise<string | undefined> {
    // 默认不做验证,子类可以覆盖
    return undefined;
  }

  /**
   * 执行前钩子
   * @param input - 输入数据
   * @param context - 执行上下文
   */
  protected async beforeExecute(input: TInput, context: ToolExecutionContext): Promise<void> {
    // 默认空实现,子类可以覆盖
  }

  /**
   * 执行后钩子
   * @param result - 执行结果
   * @param context - 执行上下文
   */
  protected async afterExecute(result: ToolExecutionResult<TOutput>, context: ToolExecutionContext): Promise<void> {
    // 默认空实现,子类可以覆盖
  }

  /**
   * 具体执行逻辑(由子类实现)
   * @param input - 输入数据
   * @param context - 执行上下文
   * @returns 执行结果
   */
  protected abstract executeInternal(input: TInput, context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>>;

  /**
   * 更新统计信息
   * @param success - 是否成功
   * @param executionTime - 执行时间(毫秒)
   * @param error - 错误信息(可选)
   */
  private updateStatistics(success: boolean, executionTime: number, error?: string): void {
    this.statistics.totalExecutions++;
    this.statistics.lastExecutionTime = executionTime;

    if (success) {
      this.statistics.successfulExecutions++;
    } else {
      this.statistics.failedExecutions++;
      this.statistics.lastError = error;
    }

    // 计算平均执行时间
    this.statistics.averageExecutionTime =
      (this.statistics.averageExecutionTime * (this.statistics.totalExecutions - 1) + executionTime) /
      this.statistics.totalExecutions;
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.statistics.totalExecutions = 0;
    this.statistics.successfulExecutions = 0;
    this.statistics.failedExecutions = 0;
    this.statistics.averageExecutionTime = 0;
    this.statistics.lastExecutionTime = 0;
    this.statistics.lastError = undefined;
  }

  /**
   * 获取工具信息
   */
  getInfo(): {
    type: string;
    name: string;
    description: string;
    enabled: boolean;
    statistics: ToolStatistics;
  } {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      statistics: { ...this.statistics },
    };
  }
}

/**
 * 创建工具配置的辅助函数
 * @param type - 工具类型
 * @param name - 工具名称
 * @param description - 工具描述
 * @param options - 其他选项
 * @returns 工具配置
 */
export function createToolConfig(
  type: string,
  name: string,
  description: string,
  options: Partial<Omit<AIToolConfig, 'type' | 'name' | 'description'>> = {}
): AIToolConfig {
  return {
    type: type as any,
    name,
    description,
    enabled: options.enabled !== false,
    retryOnFailure: options.retryOnFailure ?? false,
    maxRetries: options.maxRetries ?? 0,
    timeout: options.timeout,
    priority: options.priority ?? 0,
  };
}

