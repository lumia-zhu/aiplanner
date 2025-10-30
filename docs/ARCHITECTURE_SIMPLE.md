# 🎯 跨平台架构 - 超简单版

> **写给初中生的架构设计指南**

---

## 🏠 核心思想：搭积木

想象你要建一座房子，要能在不同地方（城市、乡村、海边）都能建：

```
┌─────────────────────────────────────┐
│  🏠 房子外观（UI）- 可以不同          │  ← 每个平台长得不一样
├─────────────────────────────────────┤
│  🚪 房子布局（业务逻辑）- 必须相同     │  ← 核心功能一样
├─────────────────────────────────────┤
│  🔧 房子地基（数据存储）- 可以不同     │  ← 适配不同环境
└─────────────────────────────────────┘
```

---

## 📦 第一步：理解三个层次

### 1️⃣ 核心层（不变的部分）

**就像**: 房子的功能（吃饭、睡觉、洗澡）

**代码位置**: `src/domain/` 和 `src/application/`

**例子**:
```typescript
// 任务的定义（到哪都一样）
interface Task {
  id: string;
  title: string;      // 标题
  completed: boolean; // 是否完成
  deadline?: Date;    // 截止日期
}

// 任务的操作（到哪都一样）
class TaskService {
  createTask(title: string) { ... }
  completeTask(id: string) { ... }
  deleteTask(id: string) { ... }
}
```

### 2️⃣ 适配层（可变的部分）

**就像**: 房子的外观（中式、欧式、现代）

**代码位置**: `src/platforms/`

**例子**:
```typescript
// 接口定义（标准）
interface INotification {
  show(message: string): void;
}

// Web 平台实现（浏览器通知）
class WebNotification implements INotification {
  show(message: string) {
    new Notification(message); // 浏览器 API
  }
}

// Mobile 平台实现（手机通知）
class MobileNotification implements INotification {
  show(message: string) {
    PushNotification.show(message); // 手机 API
  }
}
```

### 3️⃣ UI 层（展示部分）

**就像**: 房子的装修风格

**代码位置**: `src/components/`

**例子**:
```typescript
// Web 版本（用 div 和 button）
function TaskItem({ task }) {
  return (
    <div className="task">
      <input type="checkbox" checked={task.completed} />
      <span>{task.title}</span>
    </div>
  );
}

// Mobile 版本（用 React Native 组件）
function TaskItem({ task }) {
  return (
    <View style={styles.task}>
      <Checkbox value={task.completed} />
      <Text>{task.title}</Text>
    </View>
  );
}
```

---

## 🎨 第二步：建立"翻译官"（适配器）

不同平台说不同"语言"，我们需要翻译官：

### 例子：存储数据

```typescript
// 1. 定义"标准语言"（接口）
interface IStorage {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any>;
}

// 2. Web 的"翻译官"
class WebStorage implements IStorage {
  async save(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string) {
    const data = localStorage.getItem(key);
    return JSON.parse(data || 'null');
  }
}

// 3. 手机的"翻译官"
class MobileStorage implements IStorage {
  async save(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }
  
  async load(key: string) {
    return JSON.parse(await AsyncStorage.getItem(key) || 'null');
  }
}

// 4. 使用时不需要知道是哪个平台
class TaskService {
  constructor(private storage: IStorage) {} // 只知道有个存储工具
  
  async saveTasks(tasks: Task[]) {
    await this.storage.save('tasks', tasks); // 自动用对的方式存储
  }
}
```

---

## 🏭 第三步：建立"自动工厂"

根据当前平台，自动选择合适的实现：

```typescript
// 1. 检测当前平台
class PlatformDetector {
  static detect(): 'web' | 'mobile' | 'desktop' {
    if (typeof window !== 'undefined') {
      // 如果是 Electron（桌面应用）
      if (window.navigator.userAgent.includes('Electron')) {
        return 'desktop';
      }
      // 如果是手机浏览器
      if (/iPhone|Android/i.test(window.navigator.userAgent)) {
        return 'mobile';
      }
    }
    return 'web'; // 默认是网页
  }
}

// 2. 工厂自动生产合适的工具
class ServiceFactory {
  // 根据平台创建存储工具
  static createStorage(): IStorage {
    const platform = PlatformDetector.detect();
    
    if (platform === 'web') {
      return new WebStorage();
    } else if (platform === 'mobile') {
      return new MobileStorage();
    } else {
      return new DesktopStorage();
    }
  }
  
  // 根据平台创建通知工具
  static createNotification(): INotification {
    const platform = PlatformDetector.detect();
    
    if (platform === 'web') {
      return new WebNotification();
    } else if (platform === 'mobile') {
      return new MobileNotification();
    } else {
      return new DesktopNotification();
    }
  }
}

// 3. 使用时完全不需要关心平台
class MyApp {
  private storage = ServiceFactory.createStorage();
  private notification = ServiceFactory.createNotification();
  
  async init() {
    // 自动用正确的方式存储
    await this.storage.save('user', { name: '张三' });
    
    // 自动用正确的方式通知
    await this.notification.show('欢迎使用！');
  }
}
```

---

## 🚀 第四步：实际操作步骤

### 今天（1 小时）- 理解概念
✅ 阅读本文档  
✅ 理解三层架构  
✅ 理解适配器模式

### 本周（5-10 小时）- 小规模试验
1. 创建一个简单的接口（比如通知）
2. 为 Web 平台实现
3. 测试能否正常工作

```typescript
// 试验代码
// 1. 定义接口
interface INotification {
  show(message: string): void;
}

// 2. 实现 Web 版本
class WebNotification implements INotification {
  show(message: string) {
    alert(message); // 先用简单的 alert
  }
}

// 3. 测试
const notifier = new WebNotification();
notifier.show('测试通知'); // 应该弹出 alert
```

### 下周（10-20 小时）- 重构一个模块
1. 选择一个简单模块（比如任务列表）
2. 提取核心逻辑
3. 创建适配器接口
4. 测试功能是否正常

```typescript
// 重构任务列表模块

// 步骤 1: 提取核心逻辑
class TaskService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  async getTasks(): Promise<Task[]> {
    return await this.storage.load('tasks') || [];
  }
  
  async addTask(task: Task): Promise<void> {
    const tasks = await this.getTasks();
    tasks.push(task);
    await this.storage.save('tasks', tasks);
  }
}

// 步骤 2: 在 React 中使用
function TaskList() {
  const storage = ServiceFactory.createStorage();
  const taskService = new TaskService(storage);
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

### 本月（40-60 小时）- 全面重构
1. 重构所有核心模块
2. 创建完整的适配器体系
3. 编写测试
4. 更新文档

---

## 📊 进度检查清单

### 阶段 1: 基础架构 ✅
- [ ] 创建 `src/domain/` 目录
- [ ] 定义核心数据模型（Task, User, Note）
- [ ] 创建 `src/application/` 目录
- [ ] 实现 TaskService
- [ ] 测试核心逻辑

### 阶段 2: 适配器层 🔄
- [ ] 创建 `src/platforms/` 目录
- [ ] 定义 IStorage 接口
- [ ] 实现 WebStorage
- [ ] 定义 INotification 接口
- [ ] 实现 WebNotification
- [ ] 测试适配器

### 阶段 3: 工厂模式 ⏳
- [ ] 创建 PlatformDetector
- [ ] 创建 ServiceFactory
- [ ] 集成到应用中
- [ ] 测试自动切换

### 阶段 4: React 集成 ⏳
- [ ] 创建 ServiceProvider
- [ ] 创建 useService Hook
- [ ] 重构现有组件
- [ ] 测试功能

---

## 🎯 核心收益

### 现在的代码（直接依赖）
```typescript
// ❌ 问题：写死了 localStorage，只能在浏览器用
function saveTasks(tasks: Task[]) {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ❌ 问题：要改成手机版，需要到处修改代码
```

### 重构后的代码（依赖接口）
```typescript
// ✅ 优点：不管什么平台都能用
class TaskService {
  constructor(private storage: IStorage) {}
  
  async saveTasks(tasks: Task[]) {
    await this.storage.save('tasks', tasks);
  }
}

// ✅ 优点：换平台只需要换一个实现
const webStorage = new WebStorage();      // Web 版
const mobileStorage = new MobileStorage(); // 手机版
const desktopStorage = new DesktopStorage(); // 桌面版

const taskService = new TaskService(webStorage); // 自动适配
```

---

## 💡 记住这三个原则

### 1. 面向接口编程
❌ 不要写：`const storage = new WebStorage();`  
✅ 应该写：`const storage: IStorage = ServiceFactory.createStorage();`

### 2. 单一职责
❌ 不要在一个类里做太多事  
✅ 每个类只负责一件事

### 3. 依赖注入
❌ 不要在类内部 `new` 对象  
✅ 通过构造函数传入依赖

---

## 🆘 遇到问题？

### 问题 1: 不知道从哪开始？
**答**: 从存储（Storage）开始，这是最简单的

### 问题 2: 觉得太复杂？
**答**: 先只做一个模块，不要一次重构所有代码

### 问题 3: 不确定要不要抽象？
**答**: 遵循"三次原则"：同样的代码出现 3 次再抽象

---

## 📚 下一步学习

### 基础概念
1. **接口（Interface）** - 定义规范
2. **实现（Implementation）** - 具体做法
3. **依赖注入（DI）** - 传入依赖而不是自己创建

### 设计模式
1. **适配器模式** - 统一不同接口
2. **工厂模式** - 自动创建对象
3. **策略模式** - 可替换的算法

### 实践项目
1. 先重构一个小功能（比如通知）
2. 再重构一个大功能（比如任务管理）
3. 最后考虑跨平台

---

## 🎓 类比总结

### 餐厅类比
```
核心业务逻辑 = 菜谱配方（不变）
适配器 = 本地化调整（可变）
UI = 菜单设计（可变）
工厂 = 自动选择合适的厨师
```

### 插头类比
```
接口 = 标准插头形状
实现 = 不同国家的插座
适配器 = 转换插头
工厂 = 根据国家自动选择合适的插头
```

---

**记住**: 架构设计就是让代码更灵活、更容易维护、更容易扩展！

**最后更新**: 2025-10-30

