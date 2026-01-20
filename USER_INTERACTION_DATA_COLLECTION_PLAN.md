# 📊 用户交互数据收集方案（完整版）

## 目录
- [一、数据收集整体架构](#一数据收集整体架构)
- [二、数据分类详解](#二数据分类详解)
- [三、数据关系图](#三数据关系图)
- [四、数据收集清单](#四数据收集清单)
- [五、数据分析能力对照](#五数据分析能力对照)
- [六、实施方案](#六实施方案)
- [七、详细改造难度评估](#七详细改造难度评估)

---

## 一、数据收集整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          用户交互数据收集体系                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │   内容数据       │    │   事件数据       │    │   聚合数据       │        │
│   │  (What)         │    │  (When + How)   │    │  (Summary)      │        │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│            │                      │                      │                 │
│   ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐        │
│   │ • notes         │    │ • user_events   │    │ • daily_user_   │        │
│   │ • note_versions │    │ • user_sessions │    │   analytics     │        │
│   │ • daily_tasks   │    │                 │    │                 │        │
│   │ • chat_messages │    │                 │    │                 │        │
│   │ • daily_        │    │                 │    │                 │        │
│   │   reflections   │    │                 │    │                 │        │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
│   用户做了什么内容        用户何时、如何操作       按天/周/月汇总统计         │
│   （可还原状态）          （行为轨迹）           （快速查询）                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心设计思想

1. **内容数据**：记录用户创造的实体内容（笔记、任务、消息等），支持状态还原
2. **事件数据**：记录用户的每一个操作动作，支持行为分析
3. **聚合数据**：预计算常用统计指标，支持快速查询

---

## 二、数据分类详解

### 第一类：内容数据（用户创造的实体内容）

> **目的**：记录用户产出的内容，支持状态还原和内容分析

| 数据表 | 存储内容 | 用途 | 状态 |
|-------|---------|------|------|
| `notes` | 笔记当前版本（富文本 JSON） | 用户看到的最新内容 | ✅ 已实现 |
| `note_versions` | 笔记历史版本 | **可还原任意时间点的笔记** | ✅ 已实现 |
| `daily_tasks` | 任务详情 | 任务标题、状态、层级、时间估算等 | ✅ 已实现 |
| `task_matrix` | 任务在矩阵中的位置 | 象限、坐标 | ✅ 已实现 |
| `chat_messages` | 聊天消息 | 用户和 AI 的对话内容 | ✅ 已实现 |
| `daily_reflections` | 每日回顾 | 3个问题、用户回答、AI 总结 | ✅ 已实现 |
| `user_profiles` | 用户画像 | 专业、年级、挑战标签 | ✅ 已实现 |

#### 🔑 关键点：笔记版本追踪（已实现）

`note_versions` 表已经实现了完整的笔记版本追踪，每次保存都会记录：
- 完整的富文本内容（`content`）
- 纯文本版本（`plain_text`）
- 版本来源（`version_source`: `auto_save`/`manual_save`/`initial`）
- 内容长度（`content_length`）
- 任务数量（`task_count`）
- 时间戳（`created_at`）

**这意味着**：可以还原用户在任意时间点的笔记状态，满足研究需求。

---

### 第二类：事件数据（用户的行为轨迹）

> **目的**：记录用户的每一个操作动作，支持行为分析

#### 2.1 事件表结构（`user_events`）- 待创建

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- === 用户和会话 ===
  user_id UUID NOT NULL REFERENCES users(id),
  session_id UUID NOT NULL,
  
  -- === 事件标识（两级分类） ===
  event_category VARCHAR(30) NOT NULL,
  event_action VARCHAR(30) NOT NULL,
  
  -- === 操作对象 ===
  entity_type VARCHAR(30),
  entity_id UUID,
  entity_title VARCHAR(500),
  
  -- === 上下文 ===
  context_date DATE NOT NULL,
  view_mode VARCHAR(20),
  
  -- === 时间相关 ===
  created_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- === 扩展数据 ===
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- === 约束 ===
  CONSTRAINT valid_category CHECK (event_category IN 
    ('task', 'reflection', 'navigation', 'chat', 'daily_review', 'session', 'system'))
);

-- 索引
CREATE INDEX idx_user_events_user_date ON user_events(user_id, context_date);
CREATE INDEX idx_user_events_session ON user_events(session_id);
CREATE INDEX idx_user_events_category ON user_events(event_category, event_action);
CREATE INDEX idx_user_events_created ON user_events(created_at DESC);
```

#### 2.2 事件类型完整列表

| 事件大类 | 事件动作 | 触发时机 | metadata 内容 | 优先级 |
|---------|---------|---------|--------------|-------|
| **📋 task** | `created` | 创建任务时 | `{depth, isParent, parentId}` | ✅ 已有 |
| | `updated` | 修改任务属性时 | `{field, oldValue, newValue}` | ❌ 待加 |
| | `completed` | 勾选完成时 | `{timeFromCreationMs}` | **P0** |
| | `uncompleted` | 取消完成时 | `{}` | **P0** |
| | `deleted` | 删除任务时 | `{}` | **P0** |
| | `moved` | 矩阵中拖拽时 | `{fromQuadrant, toQuadrant, x, y}` | **P0** |
| | `time_estimated` | 设置时间估算时 | `{durationMinutes}` | P1 |
| | `deadline_set` | 设置截止时间时 | `{deadline}` | P1 |
| | `deadline_cleared` | 清除截止时间时 | `{}` | P1 |
| **💭 reflection** | `round_started` | 点击反思按钮时 | `{roundType, taskIds, taskCount}` | ✅ 已有 |
| | `question_shown` | 显示问题卡片时 | `{questionIndex, questionText}` | ✅ 已有 |
| | `question_answered` | 用户提交回答时 | `{answerText, responseTimeMs}` | ✅ 已有 |
| | `question_skipped` | 用户跳过问题时 | `{questionText}` | **P0** |
| | `round_completed` | 完成一轮反思时 | `{answeredCount, skippedCount}` | ✅ 已有 |
| **📝 daily_review** | `started` | 开始每日回顾时 | `{questions: [q1, q2, q3]}` | P1 |
| | `question_answered` | 回答回顾问题时 | `{questionIndex, answerText}` | P1 |
| | `question_skipped` | 跳过回顾问题时 | `{questionIndex}` | P1 |
| | `completed` | 完成每日回顾时 | `{answeredCount, aiSummaryLength}` | P1 |
| **🧭 navigation** | `view_changed` | 切换 notes/matrix 时 | `{fromMode, toMode}` | P1 |
| | `date_changed` | 切换日期时 | `{fromDate, toDate}` | P1 |
| | `matrix_axis_changed` | 切换矩阵维度时 | `{xAxis, yAxis}` | P2 |
| **💬 chat** | `message_sent` | 用户发送消息时 | `{messageLength, isReflection}` | ✅ 已有 |
| | `ai_response_received` | AI 返回回复时 | `{responseTimeMs, tokenCount}` | P1 |
| **📊 session** | `started` | 页面加载时 | `{userAgent, referrer}` | **P0** |
| | `heartbeat` | 每分钟心跳 | `{activeTimeMs, idleTimeMs}` | P2 |
| | `ended` | 页面关闭时 | `{totalDurationMs, eventsCount}` | **P0** |
| **⚠️ system** | `error_occurred` | 发生错误时 | `{errorType, errorMessage, stack}` | P2 |
| | `ai_timeout` | AI 请求超时时 | `{functionName, timeoutMs}` | P2 |

#### 2.3 会话表结构（`user_sessions`）- 待创建

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  duration_ms INTEGER,
  events_count INTEGER DEFAULT 0,
  
  device_info JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_started ON user_sessions(started_at DESC);
```

---

### 第三类：聚合数据（统计汇总）

> **目的**：预计算常用统计指标，支持快速查询

| 数据表 | 存储内容 | 聚合维度 | 状态 |
|-------|---------|---------|------|
| `daily_user_analytics` | 每日用户统计 | 按用户+日期 | ✅ 已实现 |

**聚合指标**：
- 对话统计：总消息数、反思消息数、普通消息数
- 任务统计：总任务数、父任务数、子任务数
- 反思统计：各轮次完成数、问题回答率
- 响应率统计：总问题数、已回答数、忽略数

---

## 三、数据关系图

### 3.1 事件数据关系

```
                              ┌──────────────┐
                              │    users     │
                              │   (用户表)    │
                              └──────┬───────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  user_profiles  │        │  user_sessions  │        │  user_events    │
│   (用户画像)     │        │    (会话表)      │        │   (事件表)      │
└─────────────────┘        └────────┬────────┘        └────────┬────────┘
                                    │                          │
                                    │ 1:N                      │
                                    ▼                          │
                           ┌─────────────────┐                 │
                           │  user_events    │◄────────────────┘
                           │  (通过session   │
                           │   _id关联)      │
                           └─────────────────┘
```

### 3.2 内容数据关系

```
┌─────────────────┐  1:N   ┌─────────────────┐
│     notes       │───────▶│  note_versions  │  ← 每次保存都记录版本
│   (笔记当前)     │        │   (笔记历史)     │    ✅ 已实现版本追踪
└────────┬────────┘        └─────────────────┘
         │
         │ 逻辑关联（通过 note_date）
         ▼
┌─────────────────┐  1:1   ┌─────────────────┐
│  daily_tasks    │───────▶│  task_matrix    │  ← 任务在矩阵中的位置
│   (任务列表)     │        │   (矩阵位置)     │
└─────────────────┘        └─────────────────┘

┌─────────────────┐        ┌─────────────────┐
│ chat_messages   │        │daily_reflections│
│   (聊天记录)     │        │  (每日回顾)      │
└─────────────────┘        └─────────────────┘
```

---

## 四、数据收集清单

### ✅ 已收集（现有系统）

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 笔记内容 | `notes` | 当前版本 |
| **笔记版本历史** | `note_versions` | ✅ **可还原任意时间点** |
| 任务列表 | `daily_tasks` | 包含所有属性 |
| 任务矩阵位置 | `task_matrix` | 象限、坐标 |
| 聊天消息 | `chat_messages` | 完整对话 |
| 每日回顾 | `daily_reflections` | 问题、回答、AI总结 |
| 用户画像 | `user_profiles` | 专业、挑战标签等 |
| 消息发送事件 | `user_interaction_events` | 旧表 |
| 任务创建事件 | `user_interaction_events` | 旧表 |
| 反思按钮点击 | `user_interaction_events` | 旧表 |
| 问题提问/回答 | `user_interaction_events` | 旧表 |
| 轮次完成 | `user_interaction_events` | 旧表 |

### ❌ 未收集（需要新增）

| 数据类型 | 优先级 | 分析价值 | 改造难度 |
|---------|-------|---------|---------|
| **任务完成事件** | **P0** | 任务完成率、完成时间分布 | ⭐ 简单 |
| **任务删除事件** | **P0** | 任务管理行为 | ⭐ 简单 |
| **任务拖拽事件** | **P0** | 优先级调整行为 | ⭐ 简单 |
| **问题跳过事件** | **P0** | 哪类问题被跳过 | ⭐ 简单 |
| **会话信息** | **P0** | 使用时长、频率 | ⭐⭐ 中等 |
| 视图切换事件 | P1 | 使用偏好 | ⭐ 简单 |
| 日期切换事件 | P1 | 规划习惯 | ⭐ 简单 |
| 用户回答时长 | P1 | 思考深度 | ⭐⭐ 中等 |
| AI 响应时间 | P1 | 系统性能体验 | ⭐ 简单 |
| 矩阵维度切换 | P2 | 维度使用偏好 | ⭐ 简单 |
| 错误事件 | P2 | 系统可靠性 | ⭐ 简单 |

---

## 五、数据分析能力对照

| 分析需求 | 现有能力 | 改造后能力 |
|---------|---------|-----------|
| 还原某天的笔记内容 | ✅ 可以（note_versions） | ✅ 可以 |
| 还原笔记的任意历史版本 | ✅ 可以（note_versions） | ✅ 可以 |
| 查看用户任务列表变化 | ⚠️ 部分（只有创建，无删除） | ✅ 完整 |
| 分析任务完成率 | ❌ 无法 | ✅ 可以 |
| 分析用户操作序列 | ⚠️ 部分（无会话概念） | ✅ 完整 |
| 分析问题跳过模式 | ❌ 无法 | ✅ 可以 |
| 分析使用时长 | ❌ 无法 | ✅ 可以 |
| 分析视图偏好 | ❌ 无法 | ✅ 可以 |
| 分析 AI 响应体验 | ❌ 无法 | ✅ 可以 |
| 分析任务优先级调整行为 | ❌ 无法 | ✅ 可以 |
| 重建用户完整使用流程 | ⚠️ 部分 | ✅ 完整 |

---

## 六、实施方案

### Phase 1: 基础设施（Day 1，~4h）

| 任务 | 工作量 | 产出 |
|-----|-------|------|
| 创建 `user_events` 表 | 0.5h | SQL 迁移文件 |
| 创建 `user_sessions` 表 | 0.5h | SQL 迁移文件 |
| 创建 `src/types/user-event.ts` | 0.5h | TypeScript 类型定义 |
| 创建 `src/lib/userEventService.ts` | 2h | 事件记录服务 |
| 创建 `src/hooks/useSessionTracking.ts` | 1h | Session 管理 Hook |

### Phase 2: 核心埋点（Day 2，~3h）

| 任务 | 改动文件 | 工作量 |
|-----|---------|-------|
| 任务完成事件 | `dailyTasks.ts` | 0.5h |
| 任务删除事件 | `dailyTasks.ts` | 0.5h |
| 任务拖拽事件 | `notes-dashboard/page.tsx` | 0.5h |
| 问题跳过事件 | `notes-dashboard/page.tsx` | 0.5h |
| Session 集成 | `notes-dashboard/page.tsx` | 1h |

### Phase 3: 补充埋点（Day 3，~2h）

| 任务 | 改动文件 | 工作量 |
|-----|---------|-------|
| 视图切换事件 | `notes-dashboard/page.tsx` | 0.5h |
| 日期切换事件 | `notes-dashboard/page.tsx` | 0.5h |
| AI 响应时间 | 各 AI 调用处 | 0.5h |
| 用户回答时长 | `notes-dashboard/page.tsx` | 0.5h |

### Phase 4: Admin 适配（Day 4，~2h）

| 任务 | 改动文件 | 工作量 |
|-----|---------|-------|
| 更新 `adminAnalyticsService.ts` | `adminAnalyticsService.ts` | 1h |
| 更新 Admin 后台展示 | `admin/analytics/page.tsx` | 1h |

**总计工作量**：~11h（可分多次完成）

---

## 七、详细改造难度评估

### 7.1 改造点分布

```
📁 需要改动的文件
├── 🆕 新建文件
│   ├── src/types/user-event.ts              # TypeScript 类型定义
│   ├── src/lib/userEventService.ts          # 事件服务（核心）
│   ├── src/hooks/useSessionTracking.ts      # Session 管理
│   └── supabase/migrations/xxx.sql          # 数据库迁移
│
├── 📝 主要改动（核心）
│   ├── src/lib/dailyTasks.ts                # 添加埋点，~30 行
│   └── src/app/notes-dashboard/page.tsx     # 添加埋点，~50 行
│
├── 📝 次要改动（适配）
│   ├── src/lib/analyticsService.ts          # 保持兼容（可选）
│   ├── src/lib/adminAnalyticsService.ts     # 适配新表
│   └── src/app/admin/analytics/page.tsx     # 适配新表
│
└── 🗄️ 数据库
    ├── user_events 表                       # 新建
    └── user_sessions 表                     # 新建
```

### 7.2 技术风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|-----|-------|------|---------|
| 数据库写入性能下降 | 低 | 中 | 异步写入，不阻塞 UI；建立合适索引 |
| 旧数据迁移问题 | 低 | 低 | 旧表保留，新表独立运行 |
| 埋点代码遗漏 | 中 | 低 | 分阶段补充，不影响核心功能 |
| Session 丢失（页面崩溃） | 中 | 低 | heartbeat 机制兜底；可接受数据丢失 |
| 影响现有用户功能 | 极低 | 高 | 埋点代码全部异步，错误不影响主流程 |

### 7.3 兼容性策略

| 项目 | 策略 |
|-----|------|
| 旧的 `user_interaction_events` 表 | 保留不动，作为备份 |
| 旧的 `analyticsService.ts` 函数 | 保持接口不变，内部可选转发 |
| 现有业务逻辑 | 完全不改动，只添加埋点调用 |
| Admin 后台 | 渐进式适配，旧查询先保留 |

### 7.4 不变内容（确保安全）

| 现有功能 | 说明 |
|---------|------|
| `note_versions` 版本追踪 | ✅ **保持不变**，已满足需求 |
| `notes` 内容存储 | ✅ 保持不变 |
| `daily_tasks` 任务存储 | ✅ 保持不变 |
| `chat_messages` 消息存储 | ✅ 保持不变 |
| 所有业务逻辑 | ✅ 保持不变，只添加埋点 |

---

## 八、关键设计决策

### 8.1 为什么选择事件溯源模式？

**优点**：
- ✅ 完整记录用户行为轨迹
- ✅ 可以重建任意时间点的系统状态
- ✅ 易于扩展新事件类型
- ✅ 支持多维度分析

**缺点及应对**：
- ⚠️ 数据量大 → 使用索引优化查询；定期归档旧数据
- ⚠️ 查询复杂 → 预计算聚合表（`daily_user_analytics`）

### 8.2 为什么需要 Session 概念？

**Session（会话）** = 用户一次完整的使用过程（从打开到关闭）

**分析价值**：
- 使用时长统计
- 操作序列分析（用户先做什么，后做什么）
- 任务流程完成率
- 离开原因分析

### 8.3 为什么保留 note_versions 不改动？

现有的 `note_versions` 表**已经完美满足**笔记版本追踪需求：
- ✅ 每次保存都记录完整内容
- ✅ 包含版本来源信息
- ✅ 可以还原任意历史版本
- ✅ Admin 后台已经支持查看

**无需改动，避免风险。**

---

## 九、示例：典型的数据分析场景

### 场景 1：分析用户反思行为模式

```sql
-- 查询用户跳过了哪些类型的问题
SELECT 
  metadata->>'roundType' as round_type,
  COUNT(*) as skip_count,
  array_agg(DISTINCT entity_title) as skipped_questions
FROM user_events
WHERE user_id = 'xxx'
  AND event_category = 'reflection'
  AND event_action = 'question_skipped'
  AND context_date >= '2026-01-01'
GROUP BY metadata->>'roundType'
ORDER BY skip_count DESC;
```

### 场景 2：重建用户某天的完整操作流程

```sql
-- 查询某天某个会话的所有事件
SELECT 
  created_at,
  event_category,
  event_action,
  entity_title,
  duration_ms,
  metadata
FROM user_events
WHERE user_id = 'xxx'
  AND context_date = '2026-01-15'
  AND session_id = 'yyy'
ORDER BY created_at ASC;
```

### 场景 3：还原用户某天的笔记状态

```sql
-- 查询某天某个时间点的笔记版本
SELECT content, plain_text
FROM note_versions
WHERE user_id = 'xxx'
  AND note_date = '2026-01-15'
  AND created_at <= '2026-01-15 14:30:00'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 十、总结

### 现有系统的优势

✅ **笔记版本追踪完善**：`note_versions` 表已实现，可还原任意历史版本  
✅ **内容数据完整**：任务、消息、回顾等都有记录  
✅ **基础事件收集**：反思交互的核心事件已记录

### 需要补充的部分

❌ **任务生命周期事件不完整**：缺少完成、删除、移动  
❌ **用户行为序列缺失**：无会话概念，难以分析操作流程  
❌ **关键操作未记录**：问题跳过、视图切换、AI 响应时间等

### 改造价值

通过约 **11 小时**的改造，可以获得：
- **完整的用户行为轨迹**：从打开到关闭的每个操作
- **深度分析能力**：任务完成模式、问题跳过模式、使用偏好
- **研究支持**：支持用户研究、论文数据分析
- **产品优化依据**：基于真实数据改进 AI 问题、交互流程

---

## 附录：相关文件清单

### 现有文件
- `src/lib/notes.ts` - 笔记服务（含 note_versions 写入）
- `src/lib/dailyTasks.ts` - 任务服务
- `src/lib/analyticsService.ts` - 旧事件服务
- `src/types/analytics.ts` - 旧事件类型定义

### 待创建文件
- `src/types/user-event.ts` - 新事件类型定义
- `src/lib/userEventService.ts` - 新事件服务
- `src/hooks/useSessionTracking.ts` - Session 管理
- `supabase/migrations/xxx_create_user_events.sql` - 数据库迁移

---

**文档版本**：v1.0  
**创建日期**：2026-01-20  
**最后更新**：2026-01-20
