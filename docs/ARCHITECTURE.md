# 🏗️ 跨平台通用架构设计文档

## 📋 目录
1. [架构概述](#架构概述)
2. [分层设计](#分层设计)
3. [核心原则](#核心原则)
4. [平台适配策略](#平台适配策略)
5. [具体实现方案](#具体实现方案)

---

## 🎯 架构概述

### 设计目标
支持以下平台运行相同的核心代码：
- 🌐 **Web 浏览器** (当前实现)
- 📱 **移动端 App** (React Native / Flutter)
- 💻 **桌面应用** (Electron / Tauri)
- 🔌 **浏览器插件** (Chrome Extension / Firefox Add-on)

### 核心思想
**"Write Once, Adapt Anywhere"** - 一次编写，到处适配

就像乐高积木：
- 🧱 **核心业务逻辑** = 通用积木块（不变）
- 🎨 **UI 层** = 不同颜色的外壳（可变）
- 🔌 **平台接口** = 不同的连接器（可变）

---

## 🏢 分层设计

```
┌─────────────────────────────────────────┐
│         平台特定层 (Platform Layer)        │  ← 适配不同平台
├─────────────────────────────────────────┤
│         展示层 (Presentation Layer)       │  ← UI 组件
├─────────────────────────────────────────┤
│         应用层 (Application Layer)        │  ← 业务流程
├─────────────────────────────────────────┤
│         领域层 (Domain Layer)            │  ← 核心业务逻辑
├─────────────────────────────────────────┤
│         基础设施层 (Infrastructure)       │  ← 数据存储、API
└─────────────────────────────────────────┘
```

### 1️⃣ 领域层 (Domain Layer) - 核心不变
**作用**: 定义业务规则和数据模型

**例子**（用餐厅类比）:
- 📋 任务的定义：有标题、描述、截止日期
- 🎯 优先级规则：高/中/低
- ✅ 状态变化：待办→进行中→已完成

**代码位置**:
```
src/
├── domain/
│   ├── models/           # 数据模型（任务、用户、笔记）
│   │   ├── Task.ts
│   │   ├── User.ts
│   │   └── Note.ts
│   ├── rules/            # 业务规则
│   │   ├── taskRules.ts
│   │   └── priorityRules.ts
│   └── interfaces/       # 接口定义
│       └── IRepository.ts
```

### 2️⃣ 应用层 (Application Layer) - 业务流程
**作用**: 协调业务逻辑，处理用户操作

**例子**（用餐厅类比）:
- 顾客下单 → 厨房做菜 → 上菜 → 结账（流程）

**代码位置**:
```
src/
├── application/
│   ├── services/         # 业务服务
│   │   ├── TaskService.ts
│   │   ├── AuthService.ts
│   │   └── NoteService.ts
│   └── use-cases/        # 用例（具体业务场景）
│       ├── createTask.ts
│       ├── updateTask.ts
│       └── deleteTask.ts
```

### 3️⃣ 基础设施层 (Infrastructure) - 技术实现
**作用**: 数据存储、网络请求、外部服务

**例子**（用餐厅类比）:
- 冰箱存储食材（数据库）
- 供应商送货（API）
- 收银系统（第三方服务）

**代码位置**:
```
src/
├── infrastructure/
│   ├── repositories/     # 数据访问
│   │   ├── TaskRepository.ts
│   │   └── UserRepository.ts
│   ├── api/             # API 客户端
│   │   └── supabase/
│   └── adapters/        # 外部服务适配器
│       ├── storage/
│       └── notification/
```

### 4️⃣ 展示层 (Presentation Layer) - UI 组件
**作用**: 用户界面

**例子**（用餐厅类比）:
- 菜单（任务列表）
- 点餐按钮（创建任务）
- 结账界面（完成任务）

**代码位置**:
```
src/
├── presentation/
│   ├── components/       # 通用 UI 组件
│   │   ├── TaskItem/
│   │   └── TaskForm/
│   └── containers/       # 页面容器
│       └── Dashboard/
```

### 5️⃣ 平台特定层 (Platform Layer) - 适配器
**作用**: 适配不同平台的特性

**例子**（用餐厅类比）:
- Web = 堂食
- Mobile = 外卖
- Desktop = 预订

**代码位置**:
```
src/
├── platforms/
│   ├── web/             # Web 专用
│   │   ├── router/
│   │   └── storage.ts
│   ├── mobile/          # 移动端专用
│   │   ├── navigation/
│   │   └── storage.ts
│   ├── desktop/         # 桌面端专用
│   │   └── window.ts
│   └── extension/       # 浏览器插件专用
│       └── background.ts
```

---

## 🎨 核心原则

### 1. 依赖倒置原则 (DIP)
**通俗解释**: 高层不依赖低层，都依赖抽象

**生活例子**:
你要充电，插头（接口）是标准的，不管是苹果手机还是安卓手机（具体实现）都能用。

```typescript
// ❌ 错误：直接依赖具体实现
class TaskService {
  private supabase = new SupabaseClient(); // 写死了
  
  async getTasks() {
    return this.supabase.from('tasks').select();
  }
}

// ✅ 正确：依赖抽象接口
interface ITaskRepository {
  getTasks(): Promise<Task[]>;
}

class TaskService {
  constructor(private repository: ITaskRepository) {}
  
  async getTasks() {
    return this.repository.getTasks();
  }
}

// 可以换成任何实现
class SupabaseRepository implements ITaskRepository { ... }
class LocalStorageRepository implements ITaskRepository { ... }
class FirebaseRepository implements ITaskRepository { ... }
```

### 2. 单一职责原则 (SRP)
**通俗解释**: 一个类只做一件事

**生活例子**:
厨师专门做菜，服务员专门端菜，收银员专门收钱。

```typescript
// ❌ 错误：一个类做太多事
class TaskManager {
  createTask() { ... }        // 业务逻辑
  saveToDatabase() { ... }    // 数据存储
  showNotification() { ... }  // UI 展示
  sendToServer() { ... }      // 网络请求
}

// ✅ 正确：职责分离
class TaskService {
  createTask() { ... }        // 只管业务逻辑
}

class TaskRepository {
  save() { ... }              // 只管数据存储
}

class NotificationService {
  show() { ... }              // 只管通知
}
```

### 3. 开闭原则 (OCP)
**通俗解释**: 对扩展开放，对修改关闭

**生活例子**:
手机壳：不改变手机本身，但能添加新功能（支架、镜子）。

```typescript
// 基础存储接口
interface IStorage {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any>;
}

// Web 平台实现
class WebStorage implements IStorage {
  async save(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string) {
    return JSON.parse(localStorage.getItem(key) || 'null');
  }
}

// Mobile 平台实现（新增，不修改原代码）
class MobileStorage implements IStorage {
  async save(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string) {
    const data = await AsyncStorage.getItem(key);
    return JSON.parse(data || 'null');
  }
}

// Desktop 平台实现（新增，不修改原代码）
class DesktopStorage implements IStorage {
  async save(key: string, value: any) {
    await fs.writeFile(`./data/${key}.json`, JSON.stringify(value));
  }
  
  async load(key: string) {
    const data = await fs.readFile(`./data/${key}.json`, 'utf-8');
    return JSON.parse(data);
  }
}
```

---

## 🔌 平台适配策略

### 策略 1: 适配器模式 (Adapter Pattern)

**通俗解释**: 转换接头，让不同设备能连接

**生活例子**:
- 中国用 220V，美国用 110V
- 用电压转换器（适配器）就能通用

```typescript
// 统一的通知接口
interface INotificationService {
  show(title: string, message: string): Promise<void>;
  schedule(time: Date, title: string, message: string): Promise<void>;
}

// Web 平台适配器
class WebNotificationAdapter implements INotificationService {
  async show(title: string, message: string) {
    if ('Notification' in window) {
      await Notification.requestPermission();
      new Notification(title, { body: message });
    } else {
      // 降级方案：使用 toast 提示
      alert(`${title}: ${message}`);
    }
  }
  
  async schedule(time: Date, title: string, message: string) {
    // Web 使用 setTimeout + Service Worker
    const delay = time.getTime() - Date.now();
    setTimeout(() => this.show(title, message), delay);
  }
}

// Mobile 平台适配器
class MobileNotificationAdapter implements INotificationService {
  async show(title: string, message: string) {
    // 使用 React Native 的本地通知
    await PushNotification.localNotification({
      title,
      message,
    });
  }
  
  async schedule(time: Date, title: string, message: string) {
    // 使用系统调度器
    await PushNotification.localNotificationSchedule({
      title,
      message,
      date: time,
    });
  }
}

// Desktop 平台适配器
class DesktopNotificationAdapter implements INotificationService {
  async show(title: string, message: string) {
    // 使用 Electron 的系统通知
    const { Notification } = require('electron');
    new Notification({ title, body: message }).show();
  }
  
  async schedule(time: Date, title: string, message: string) {
    // 使用系统任务调度
    // ...
  }
}
```

### 策略 2: 工厂模式 (Factory Pattern)

**通俗解释**: 根据需求自动选择合适的实现

**生活例子**:
- 你说"我要喝饮料"
- 工厂根据场景给你：咖啡店给咖啡，奶茶店给奶茶

```typescript
// 平台检测
class PlatformDetector {
  static getCurrentPlatform(): 'web' | 'mobile' | 'desktop' | 'extension' {
    if (typeof window !== 'undefined') {
      if (window.navigator.userAgent.includes('Electron')) return 'desktop';
      if (window.chrome?.runtime?.id) return 'extension';
      if (/iPhone|iPad|Android/i.test(window.navigator.userAgent)) return 'mobile';
      return 'web';
    }
    return 'web';
  }
}

// 服务工厂
class ServiceFactory {
  static createNotificationService(): INotificationService {
    const platform = PlatformDetector.getCurrentPlatform();
    
    switch (platform) {
      case 'web':
        return new WebNotificationAdapter();
      case 'mobile':
        return new MobileNotificationAdapter();
      case 'desktop':
        return new DesktopNotificationAdapter();
      case 'extension':
        return new ExtensionNotificationAdapter();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
  
  static createStorageService(): IStorage {
    const platform = PlatformDetector.getCurrentPlatform();
    
    switch (platform) {
      case 'web':
        return new WebStorage();
      case 'mobile':
        return new MobileStorage();
      case 'desktop':
        return new DesktopStorage();
      default:
        return new WebStorage(); // 默认实现
    }
  }
}

// 使用示例（业务代码完全不需要关心平台）
class TaskService {
  private notificationService = ServiceFactory.createNotificationService();
  private storage = ServiceFactory.createStorageService();
  
  async createTask(task: Task) {
    // 保存任务（自动使用正确的存储方式）
    await this.storage.save(`task:${task.id}`, task);
    
    // 发送通知（自动使用正确的通知方式）
    await this.notificationService.show(
      '任务创建成功',
      task.title
    );
  }
}
```

### 策略 3: 配置驱动 (Configuration-Driven)

**通俗解释**: 用配置文件控制行为

**生活例子**:
餐厅菜单：同样的菜，不同地区价格不同，用价格表控制。

```typescript
// 平台配置接口
interface PlatformConfig {
  name: string;
  features: {
    notification: boolean;
    offline: boolean;
    fileUpload: boolean;
    camera: boolean;
  };
  storage: {
    type: 'localStorage' | 'asyncStorage' | 'sqlite' | 'indexedDB';
    maxSize: number; // MB
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    layout: 'desktop' | 'mobile' | 'tablet';
  };
}

// Web 平台配置
const webConfig: PlatformConfig = {
  name: 'web',
  features: {
    notification: true,
    offline: true,
    fileUpload: true,
    camera: false,
  },
  storage: {
    type: 'indexedDB',
    maxSize: 50,
  },
  ui: {
    theme: 'auto',
    layout: 'desktop',
  },
};

// Mobile 平台配置
const mobileConfig: PlatformConfig = {
  name: 'mobile',
  features: {
    notification: true,
    offline: true,
    fileUpload: true,
    camera: true, // 移动端支持相机
  },
  storage: {
    type: 'asyncStorage',
    maxSize: 100,
  },
  ui: {
    theme: 'auto',
    layout: 'mobile',
  },
};

// 配置管理器
class ConfigManager {
  private static config: PlatformConfig;
  
  static init() {
    const platform = PlatformDetector.getCurrentPlatform();
    switch (platform) {
      case 'web':
        this.config = webConfig;
        break;
      case 'mobile':
        this.config = mobileConfig;
        break;
      // ... 其他平台
    }
  }
  
  static getConfig(): PlatformConfig {
    return this.config;
  }
  
  static hasFeature(feature: keyof PlatformConfig['features']): boolean {
    return this.config.features[feature];
  }
}

// 使用示例
class CameraService {
  async takePhoto() {
    if (!ConfigManager.hasFeature('camera')) {
      throw new Error('当前平台不支持相机功能');
    }
    
    // 执行拍照逻辑
    // ...
  }
}
```

---

## 📦 具体实现方案

### 阶段 1: 重构当前代码（1-2 周）

#### 目标
将现有代码按分层架构重组

#### 步骤

**第 1 步: 提取领域模型**
```typescript
// src/domain/models/Task.ts
export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: Date;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  tags: string[];
  reminderTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// src/domain/models/Note.ts
export interface Note {
  id: string;
  title: string;
  content: string; // Tiptap JSON
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}
```

**第 2 步: 定义接口**
```typescript
// src/domain/interfaces/ITaskRepository.ts
export interface ITaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(task: Omit<Task, 'id'>): Promise<Task>;
  update(id: string, task: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
}

// src/domain/interfaces/INotificationService.ts
export interface INotificationService {
  show(title: string, message: string): Promise<void>;
  schedule(time: Date, title: string, message: string): Promise<string>;
  cancel(id: string): Promise<void>;
}
```

**第 3 步: 实现应用服务**
```typescript
// src/application/services/TaskService.ts
export class TaskService {
  constructor(
    private taskRepository: ITaskRepository,
    private notificationService: INotificationService
  ) {}
  
  async createTaskWithReminder(
    taskData: Omit<Task, 'id'>,
    reminderTime?: Date
  ): Promise<Task> {
    // 创建任务
    const task = await this.taskRepository.create(taskData);
    
    // 设置提醒
    if (reminderTime) {
      await this.notificationService.schedule(
        reminderTime,
        '任务提醒',
        task.title
      );
    }
    
    return task;
  }
  
  async completeTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error('任务不存在');
    
    await this.taskRepository.update(taskId, { completed: true });
  }
}
```

**第 4 步: 实现基础设施层**
```typescript
// src/infrastructure/repositories/SupabaseTaskRepository.ts
export class SupabaseTaskRepository implements ITaskRepository {
  constructor(private supabase: SupabaseClient) {}
  
  async findAll(): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Task[];
  }
  
  // ... 其他方法实现
}
```

### 阶段 2: 创建平台适配器（2-3 周）

#### Web 平台适配器
```typescript
// src/platforms/web/adapters/WebStorageAdapter.ts
export class WebStorageAdapter implements IStorage {
  async save(key: string, value: any): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string): Promise<any> {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
}

// src/platforms/web/adapters/WebNotificationAdapter.ts
export class WebNotificationAdapter implements INotificationService {
  async show(title: string, message: string): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }
  
  async schedule(time: Date, title: string, message: string): Promise<string> {
    const delay = time.getTime() - Date.now();
    const timerId = setTimeout(() => {
      this.show(title, message);
    }, delay);
    return String(timerId);
  }
  
  async cancel(id: string): Promise<void> {
    clearTimeout(Number(id));
  }
}
```

#### Mobile 平台适配器（预留）
```typescript
// src/platforms/mobile/adapters/MobileStorageAdapter.ts
export class MobileStorageAdapter implements IStorage {
  async save(key: string, value: any): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string): Promise<any> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
}
```

### 阶段 3: 依赖注入容器（1 周）

```typescript
// src/infrastructure/di/Container.ts
export class DIContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory);
  }
  
  resolve<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) throw new Error(`Service not found: ${name}`);
    return factory();
  }
}

// src/infrastructure/di/setup.ts
export function setupDI(): DIContainer {
  const container = new DIContainer();
  
  // 注册基础服务
  container.register('supabase', () => createClient(...));
  
  // 注册仓储
  container.register('taskRepository', () => 
    new SupabaseTaskRepository(container.resolve('supabase'))
  );
  
  // 注册平台服务
  const notificationFactory = () => {
    const platform = PlatformDetector.getCurrentPlatform();
    switch (platform) {
      case 'web': return new WebNotificationAdapter();
      case 'mobile': return new MobileNotificationAdapter();
      default: return new WebNotificationAdapter();
    }
  };
  container.register('notificationService', notificationFactory);
  
  // 注册应用服务
  container.register('taskService', () => 
    new TaskService(
      container.resolve('taskRepository'),
      container.resolve('notificationService')
    )
  );
  
  return container;
}
```

### 阶段 4: 在 React 中使用（1 周）

```typescript
// src/presentation/contexts/ServiceContext.tsx
import React, { createContext, useContext } from 'react';
import { DIContainer } from '@/infrastructure/di/Container';

const ServiceContext = createContext<DIContainer | null>(null);

export function ServiceProvider({ 
  container, 
  children 
}: { 
  container: DIContainer;
  children: React.ReactNode;
}) {
  return (
    <ServiceContext.Provider value={container}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useService<T>(name: string): T {
  const container = useContext(ServiceContext);
  if (!container) throw new Error('ServiceProvider not found');
  return container.resolve<T>(name);
}

// 使用示例
// src/presentation/components/TaskList.tsx
export function TaskList() {
  const taskService = useService<TaskService>('taskService');
  const [tasks, setTasks] = useState<Task[]>([]);
  
  useEffect(() => {
    taskService.getTasks().then(setTasks);
  }, []);
  
  return (
    <div>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

---

## 📊 迁移路线图

### 短期（1-2 个月）
- ✅ 重构现有代码为分层架构
- ✅ 提取核心业务逻辑
- ✅ 创建平台适配器接口
- ✅ 实现 Web 平台适配器

### 中期（3-6 个月）
- 📱 实现 Mobile 平台适配器
- 💻 实现 Desktop 平台适配器
- 🧪 完善单元测试和集成测试
- 📚 编写详细文档

### 长期（6-12 个月）
- 🔌 实现浏览器插件版本
- 🌐 支持离线模式
- 🔄 实现跨平台数据同步
- 🚀 性能优化和监控

---

## 🎓 学习资源

### 推荐阅读
1. **Clean Architecture** by Robert C. Martin
   - 中文名：《架构整洁之道》
   
2. **Domain-Driven Design** by Eric Evans
   - 中文名：《领域驱动设计》

### 在线教程
- [Martin Fowler's Blog](https://martinfowler.com/) - 架构模式
- [React Native 官方文档](https://reactnative.dev/) - 移动端开发
- [Electron 官方文档](https://www.electronjs.org/) - 桌面应用开发

---

## 💡 最佳实践

### 1. 保持接口简单
```typescript
// ✅ 好的接口设计
interface INotificationService {
  show(title: string, message: string): Promise<void>;
}

// ❌ 过度设计
interface INotificationService {
  showBasic(title: string): void;
  showWithMessage(title: string, message: string): void;
  showWithIcon(title: string, message: string, icon: string): void;
  showWithSound(title: string, message: string, sound: string): void;
  // ... 太多方法了
}
```

### 2. 使用类型安全
```typescript
// ✅ 使用 TypeScript 严格模式
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 3. 编写测试
```typescript
// src/__tests__/TaskService.test.ts
describe('TaskService', () => {
  let taskService: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  
  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      // ...
    };
    taskService = new TaskService(mockRepository, mockNotificationService);
  });
  
  it('应该能创建任务', async () => {
    const taskData = { title: '测试任务', ... };
    mockRepository.create.mockResolvedValue({ id: '1', ...taskData });
    
    const task = await taskService.createTask(taskData);
    
    expect(task.id).toBe('1');
    expect(mockRepository.create).toHaveBeenCalledWith(taskData);
  });
});
```

---

## 🚨 常见陷阱

### 陷阱 1: 过度抽象
❌ **错误**: 为每个小功能都创建接口和适配器
✅ **正确**: 只为可能变化的部分创建抽象

### 陷阱 2: 循环依赖
❌ **错误**: A 依赖 B，B 又依赖 A
✅ **正确**: 使用依赖注入和接口隔离

### 陷阱 3: 平台特定代码泄漏
❌ **错误**: 在业务逻辑中使用 `window.localStorage`
✅ **正确**: 通过适配器访问平台特性

---

## 📞 获取帮助

如果在实施过程中遇到问题：
1. 查看本文档的示例代码
2. 参考 `src/` 目录下的实际实现
3. 在项目 Issues 中提问

---

**最后更新**: 2025-10-30  
**维护者**: 项目团队

