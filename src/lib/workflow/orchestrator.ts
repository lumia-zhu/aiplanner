/**
 * 工作流编排引擎
 * 负责协调和执行整个工作流
 */

import type { WorkflowPhase, WorkflowConfig } from '@/types/workflow';
import { WorkflowContextManager } from './context';
import type { ToolRegistry } from '@/lib/tools/registry';
import type { AIService } from '@/lib/ai/service';
import { workflowSteps, getStepByPhase } from './steps';
import type { StepExecutionResult } from './steps';

/**
 * 工作流执行选项
 */
export interface WorkflowExecutionOptions {
  /** 用户 ID */
  userId: string;
  /** 初始任务列表 */
  tasks: any[];
  /** 自动执行(不等待用户确认) */
  autoExecute?: boolean;
  /** 跳过的阶段 */
  skipPhases?: WorkflowPhase[];
  /** 最大步骤数(防止无限循环) */
  maxSteps?: number;
}

/**
 * 工作流执行结果
 */
export interface WorkflowExecutionResult {
  success: boolean;
  finalPhase: WorkflowPhase;
  executedSteps: string[];
  context: any;
  error?: string;
}

/**
 * 工作流编排器类
 */
export class WorkflowOrchestrator {
  /** 上下文管理器 */
  private contextManager: WorkflowContextManager;

  /** 工具注册中心 */
  private toolRegistry: ToolRegistry;

  /** AI 服务 */
  private aiService: AIService;

  /** 工作流配置 */
  private config: WorkflowConfig;

  /** 已执行的步骤 */
  private executedSteps: string[] = [];

  /** 是否正在执行 */
  private isExecuting: boolean = false;

  /**
   * 构造函数
   * @param toolRegistry - 工具注册中心
   * @param aiService - AI 服务
   * @param config - 工作流配置
   */
  constructor(
    toolRegistry: ToolRegistry,
    aiService: AIService,
    config?: Partial<WorkflowConfig>
  ) {
    this.toolRegistry = toolRegistry;
    this.aiService = aiService;
    this.contextManager = new WorkflowContextManager();

    // 默认配置
    this.config = {
      startPhase: config?.startPhase || 'initial',
      endPhase: config?.endPhase || 'completed',
      autoTransition: config?.autoTransition !== false,
      enableCaching: config?.enableCaching !== false,
      timeout: config?.timeout || 60000, // 60 秒
      phases: config?.phases || this.getDefaultPhaseConfigs(),
    };
  }

  /**
   * 获取默认阶段配置
   */
  private getDefaultPhaseConfigs() {
    return new Map([
      ['initial', { phase: 'initial' as WorkflowPhase, steps: [], transitions: ['analyzing'] }],
      ['analyzing', { phase: 'analyzing' as WorkflowPhase, steps: ['analyze'], transitions: ['clarifying', 'decomposing', 'estimating'] }],
      ['clarifying', { phase: 'clarifying' as WorkflowPhase, steps: ['clarify'], transitions: ['decomposing'] }],
      ['decomposing', { phase: 'decomposing' as WorkflowPhase, steps: ['decompose'], transitions: ['estimating'] }],
      ['estimating', { phase: 'estimating' as WorkflowPhase, steps: ['estimate'], transitions: ['prioritizing'] }],
      ['prioritizing', { phase: 'prioritizing' as WorkflowPhase, steps: ['prioritize'], transitions: ['checking'] }],
      ['checking', { phase: 'checking' as WorkflowPhase, steps: ['checklist'], transitions: ['completed'] }],
      ['completed', { phase: 'completed' as WorkflowPhase, steps: [], transitions: [] }],
    ]);
  }

  /**
   * 执行工作流
   * @param options - 执行选项
   * @returns 执行结果
   */
  async execute(options: WorkflowExecutionOptions): Promise<WorkflowExecutionResult> {
    if (this.isExecuting) {
      return {
        success: false,
        finalPhase: this.contextManager.getPhase(),
        executedSteps: this.executedSteps,
        context: this.contextManager.getContext(),
        error: '工作流正在执行中',
      };
    }

    this.isExecuting = true;
    this.executedSteps = [];

    try {
      console.log('🚀 开始执行工作流...');

      // 初始化上下文
      this.contextManager.updateContext({
        userId: options.userId,
        tasks: options.tasks,
        currentPhase: 'analyzing',
      });

      const maxSteps = options.maxSteps || 10;
      const skipPhases = new Set(options.skipPhases || []);

      let currentPhase: WorkflowPhase = 'analyzing';
      let stepCount = 0;

      // 执行工作流循环
      while (currentPhase !== 'completed' && stepCount < maxSteps) {
        stepCount++;

        console.log(`\n📍 当前阶段: ${currentPhase} (步骤 ${stepCount}/${maxSteps})`);

        // 检查是否跳过该阶段
        if (skipPhases.has(currentPhase)) {
          console.log(`⏭️ 跳过阶段: ${currentPhase}`);
          const phaseConfig = this.config.phases.get(currentPhase);
          if (phaseConfig && phaseConfig.transitions.length > 0) {
            currentPhase = phaseConfig.transitions[0];
            this.contextManager.setPhase(currentPhase);
            continue;
          } else {
            break;
          }
        }

        // 执行当前阶段的步骤
        const result = await this.executePhase(currentPhase);

        if (!result.success) {
          console.error(`❌ 阶段执行失败: ${result.error}`);
          return {
            success: false,
            finalPhase: currentPhase,
            executedSteps: this.executedSteps,
            context: this.contextManager.getContext(),
            error: result.error,
          };
        }

        // 根据结果决定下一阶段
        if (result.nextPhase) {
          currentPhase = result.nextPhase;
          this.contextManager.setPhase(currentPhase);
        } else {
          // 没有下一阶段,使用默认转换
          const phaseConfig = this.config.phases.get(currentPhase);
          if (phaseConfig && phaseConfig.transitions.length > 0) {
            currentPhase = phaseConfig.transitions[0];
            this.contextManager.setPhase(currentPhase);
          } else {
            break;
          }
        }
      }

      if (stepCount >= maxSteps) {
        console.warn(`⚠️ 达到最大步骤数限制: ${maxSteps}`);
      }

      console.log(`\n🎉 工作流执行完成! 最终阶段: ${currentPhase}`);
      console.log(`📊 执行统计: 共执行 ${this.executedSteps.length} 个步骤`);

      return {
        success: true,
        finalPhase: currentPhase,
        executedSteps: this.executedSteps,
        context: this.contextManager.getContext(),
      };
    } catch (error) {
      console.error('❌ 工作流执行异常:', error);
      return {
        success: false,
        finalPhase: this.contextManager.getPhase(),
        executedSteps: this.executedSteps,
        context: this.contextManager.getContext(),
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 执行单个阶段
   * @param phase - 工作流阶段
   * @returns 执行结果
   */
  private async executePhase(phase: WorkflowPhase): Promise<StepExecutionResult> {
    const step = getStepByPhase(phase);

    if (!step) {
      console.log(`ℹ️ 阶段 ${phase} 没有对应的步骤,跳过`);
      return { success: true };
    }

    console.log(`▶️ 执行步骤: ${step.name}`);

    // 检查必需的工具是否可用
    for (const toolType of step.requiredTools) {
      if (!this.toolRegistry.hasTool(toolType)) {
        return {
          success: false,
          error: `缺少必需的工具: ${toolType}`,
        };
      }
    }

    // 执行步骤
    try {
      const result = await step.execute(
        this.contextManager,
        this.toolRegistry,
        this.aiService
      );

      if (result.success) {
        this.executedSteps.push(step.id);
        console.log(`✅ 步骤执行成功: ${step.name}`);
      } else {
        console.error(`❌ 步骤执行失败: ${step.name} - ${result.error}`);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行单个步骤(手动控制)
   * @param stepId - 步骤 ID
   * @param input - 输入数据
   * @returns 执行结果
   */
  async executeStep(stepId: string, input?: any): Promise<StepExecutionResult> {
    const step = workflowSteps.get(stepId);

    if (!step) {
      return {
        success: false,
        error: `步骤不存在: ${stepId}`,
      };
    }

    console.log(`▶️ 手动执行步骤: ${step.name}`);

    try {
      const result = await step.execute(
        this.contextManager,
        this.toolRegistry,
        this.aiService,
        input
      );

      if (result.success) {
        this.executedSteps.push(step.id);

        // 自动转换阶段
        if (result.nextPhase) {
          this.contextManager.setPhase(result.nextPhase);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取上下文管理器
   */
  getContextManager(): WorkflowContextManager {
    return this.contextManager;
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): WorkflowPhase {
    return this.contextManager.getPhase();
  }

  /**
   * 重置工作流
   */
  reset(): void {
    this.contextManager.reset();
    this.executedSteps = [];
    this.isExecuting = false;
    console.log('🔄 工作流已重置');
  }

  /**
   * 获取执行摘要
   */
  getSummary() {
    return {
      isExecuting: this.isExecuting,
      executedSteps: this.executedSteps,
      context: this.contextManager.getSummary(),
    };
  }
}

