/**
 * 压力测试启动脚本
 * 自动加载 .env.local 并运行压力测试
 */

const fs = require('fs');
const path = require('path');

// 加载 .env.local 文件
const envPath = path.join(__dirname, '.env.local');

if (fs.existsSync(envPath)) {
  console.log('✓ 找到 .env.local 文件');
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    line = line.trim();
    
    // 跳过注释和空行
    if (!line || line.startsWith('#')) {
      return;
    }
    
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    
    if (key && value) {
      process.env[key.trim()] = value;
    }
  });
  
  console.log('✓ 环境变量加载完成\n');
} else {
  console.error('❌ 未找到 .env.local 文件');
  process.exit(1);
}

// 运行压力测试
require('./stress-test.js');

