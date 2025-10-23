/**
 * 压力测试脚本 - 模拟20个并发用户
 * 测试系统在多用户同时操作下的性能表现
 */

const https = require('https');
const http = require('http');

// ==================== 配置 ====================
const CONFIG = {
  BASE_URL: process.env.TEST_URL || 'http://localhost:3000',
  CONCURRENT_USERS: 20,
  TEST_DURATION_MS: 60000, // 60秒
  REQUEST_INTERVAL_MS: 2000, // 每2秒发一次请求
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

// ==================== 性能指标 ====================
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  requestsByType: {},
  startTime: null,
  endTime: null,
};

// ==================== 辅助函数 ====================

/**
 * 生成随机UUID（符合数据库要求）
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成随机用户ID（使用UUID格式）
 */
function generateUserId() {
  return generateUUID();
}

/**
 * 生成随机任务数据
 */
function generateTask(userId) {
  const priorities = ['low', 'medium', 'high'];
  const titles = [
    '准备下周汇报',
    '整理参考文献',
    '完成项目报告',
    'Qualify Exam复习',
    '做TA批改作业',
    '写论文摘要',
    'CHI审稿',
  ];
  
  return {
    user_id: userId,
    title: titles[Math.floor(Math.random() * titles.length)],
    description: `测试任务 - ${new Date().toISOString()}`,
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    deadline_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed: false,
  };
}

/**
 * 发送HTTP请求
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const responseData = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 300,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 300,
          });
        }
      });
    });
    
    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      reject({
        error: error.message,
        responseTime,
        success: false,
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 创建测试用户
 */
async function createUserViaSupabase(userId) {
  const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/users`);
  
  const userData = {
    id: userId,
    username: `test_user_${userId.substring(0, 8)}`,
    password_hash: 'stress_test_dummy_hash',
  };
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    protocol: url.protocol,
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  };
  
  return makeRequest(options, userData);
}

/**
 * 直接调用Supabase API创建任务
 */
async function createTaskViaSupabase(taskData) {
  const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/tasks`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    protocol: url.protocol,
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  };
  
  return makeRequest(options, taskData);
}

/**
 * 查询任务列表
 */
async function getTasksViaSupabase(userId) {
  const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/tasks?user_id=eq.${userId}&select=*`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'GET',
    protocol: url.protocol,
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
    },
  };
  
  return makeRequest(options);
}

/**
 * 更新任务状态
 */
async function updateTaskViaSupabase(taskId, updates) {
  const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'PATCH',
    protocol: url.protocol,
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  };
  
  return makeRequest(options, updates);
}

/**
 * 模拟单个用户的操作
 */
async function simulateUser(userId, duration) {
  const userStartTime = Date.now();
  const userMetrics = {
    requests: 0,
    successes: 0,
    failures: 0,
  };
  
  console.log(`[User ${userId.substring(0, 8)}...] 开始测试...`);
  
  // 先创建测试用户
  try {
    await createUserViaSupabase(userId);
    console.log(`[User ${userId.substring(0, 8)}...] 用户创建成功`);
  } catch (error) {
    // 用户可能已存在，继续测试
    console.log(`[User ${userId.substring(0, 8)}...] 用户已存在或创建失败，继续测试`);
  }
  
  while (Date.now() - userStartTime < duration) {
    try {
      // 随机执行不同操作
      const action = Math.random();
      
      if (action < 0.4) {
        // 40%概率：创建任务
        const task = generateTask(userId);
        const result = await createTaskViaSupabase(task);
        
        metrics.totalRequests++;
        userMetrics.requests++;
        
        if (result.success) {
          metrics.successfulRequests++;
          userMetrics.successes++;
        } else {
          metrics.failedRequests++;
          userMetrics.failures++;
          metrics.errors.push({
            type: 'create_task',
            userId,
            error: result.error || `Status ${result.statusCode}`,
          });
        }
        
        metrics.responseTimes.push(result.responseTime);
        metrics.requestsByType['create_task'] = (metrics.requestsByType['create_task'] || 0) + 1;
        
      } else if (action < 0.8) {
        // 40%概率：查询任务列表
        const result = await getTasksViaSupabase(userId);
        
        metrics.totalRequests++;
        userMetrics.requests++;
        
        if (result.success) {
          metrics.successfulRequests++;
          userMetrics.successes++;
        } else {
          metrics.failedRequests++;
          userMetrics.failures++;
          metrics.errors.push({
            type: 'get_tasks',
            userId,
            error: result.error || `Status ${result.statusCode}`,
          });
        }
        
        metrics.responseTimes.push(result.responseTime);
        metrics.requestsByType['get_tasks'] = (metrics.requestsByType['get_tasks'] || 0) + 1;
        
      } else {
        // 20%概率：更新任务状态
        // 先查询任务，再更新
        const tasksResult = await getTasksViaSupabase(userId);
        
        if (tasksResult.success && tasksResult.data && tasksResult.data.length > 0) {
          const taskToUpdate = tasksResult.data[0];
          const result = await updateTaskViaSupabase(taskToUpdate.id, {
            completed: !taskToUpdate.completed,
          });
          
          metrics.totalRequests++;
          userMetrics.requests++;
          
          if (result.success) {
            metrics.successfulRequests++;
            userMetrics.successes++;
          } else {
            metrics.failedRequests++;
            userMetrics.failures++;
            metrics.errors.push({
              type: 'update_task',
              userId,
              error: result.error || `Status ${result.statusCode}`,
            });
          }
          
          metrics.responseTimes.push(result.responseTime);
          metrics.requestsByType['update_task'] = (metrics.requestsByType['update_task'] || 0) + 1;
        }
      }
      
      // 等待一段时间再发送下一个请求
      await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_INTERVAL_MS));
      
    } catch (error) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      userMetrics.requests++;
      userMetrics.failures++;
      metrics.errors.push({
        type: 'unknown',
        userId,
        error: error.message || error.error,
      });
    }
  }
  
  console.log(`[User ${userId.substring(0, 8)}...] 测试完成: ${userMetrics.successes}成功 / ${userMetrics.failures}失败`);
  return userMetrics;
}

/**
 * 计算统计数据
 */
function calculateStats() {
  if (metrics.responseTimes.length === 0) {
    return {
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }
  
  const sorted = metrics.responseTimes.sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  return {
    avgResponseTime: Math.round(sum / sorted.length),
    minResponseTime: sorted[0],
    maxResponseTime: sorted[sorted.length - 1],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

/**
 * 生成测试报告
 */
function generateReport() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const stats = calculateStats();
  const successRate = (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2);
  const requestsPerSecond = (metrics.totalRequests / duration).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 压力测试报告');
  console.log('='.repeat(60));
  console.log(`\n测试配置:`);
  console.log(`  - 并发用户数: ${CONFIG.CONCURRENT_USERS}`);
  console.log(`  - 测试时长: ${CONFIG.TEST_DURATION_MS / 1000}秒`);
  console.log(`  - 请求间隔: ${CONFIG.REQUEST_INTERVAL_MS}ms`);
  console.log(`\n总体指标:`);
  console.log(`  - 总请求数: ${metrics.totalRequests}`);
  console.log(`  - 成功请求: ${metrics.successfulRequests} (${successRate}%)`);
  console.log(`  - 失败请求: ${metrics.failedRequests}`);
  console.log(`  - 请求速率: ${requestsPerSecond} req/s`);
  console.log(`\n响应时间 (ms):`);
  console.log(`  - 平均: ${stats.avgResponseTime}ms`);
  console.log(`  - 最小: ${stats.minResponseTime}ms`);
  console.log(`  - 最大: ${stats.maxResponseTime}ms`);
  console.log(`  - P50: ${stats.p50}ms`);
  console.log(`  - P95: ${stats.p95}ms`);
  console.log(`  - P99: ${stats.p99}ms`);
  console.log(`\n请求类型分布:`);
  Object.entries(metrics.requestsByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count} 次`);
  });
  
  if (metrics.errors.length > 0) {
    console.log(`\n❌ 错误汇总 (前10个):`);
    metrics.errors.slice(0, 10).forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.type}] User ${error.userId}: ${error.error}`);
    });
    
    if (metrics.errors.length > 10) {
      console.log(`  ... 还有 ${metrics.errors.length - 10} 个错误`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // 判断测试结果
  if (successRate >= 95) {
    console.log('✅ 测试通过！系统表现良好');
  } else if (successRate >= 85) {
    console.log('⚠️  警告：部分请求失败，建议优化');
  } else {
    console.log('❌ 测试失败：大量请求失败，需要紧急处理');
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * 主测试函数
 */
async function runStressTest() {
  console.log('\n🚀 开始压力测试...\n');
  console.log(`配置:`);
  console.log(`  - Supabase URL: ${CONFIG.SUPABASE_URL}`);
  console.log(`  - 并发用户: ${CONFIG.CONCURRENT_USERS}`);
  console.log(`  - 测试时长: ${CONFIG.TEST_DURATION_MS / 1000}秒`);
  console.log('\n');
  
  // 检查配置
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    console.error('❌ 错误：未配置 Supabase URL 或 API Key');
    console.error('请在 .env.local 中配置：');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=your_url');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key');
    process.exit(1);
  }
  
  metrics.startTime = Date.now();
  
  // 创建并发用户
  const users = Array.from(
    { length: CONFIG.CONCURRENT_USERS },
    (_, i) => generateUserId()
  );
  
  // 并发执行所有用户的操作
  const userPromises = users.map(userId => 
    simulateUser(userId, CONFIG.TEST_DURATION_MS)
  );
  
  // 等待所有用户完成
  await Promise.all(userPromises);
  
  metrics.endTime = Date.now();
  
  // 生成报告
  generateReport();
}

// ==================== 执行测试 ====================
if (require.main === module) {
  runStressTest().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

module.exports = { runStressTest };

// 如果作为模块被require，也自动执行
if (require.main !== module && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  runStressTest().catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
}

