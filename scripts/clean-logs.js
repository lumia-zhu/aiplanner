/**
 * 批量清理项目中的调试日志
 * 
 * 使用方式：
 * node scripts/clean-logs.js
 */

const fs = require('fs');
const path = require('path');

// 需要清理的文件模式
const filesToClean = [
  'src/app/notes-dashboard/page.tsx',
  'src/lib/agent/ReactAgent.ts',
  'src/lib/agent/AgentPrompt.ts',
  'src/lib/agent/AgentMemory.ts',
];

// 要删除的日志模式（完整行删除）
const patternsToRemove = [
  /^\s*console\.log\('🚀.*\)\s*$/,  // 渲染日志
  /^\s*console\.log\('🎯.*\)\s*$/,  // 调试日志
  /^\s*console\.log\('🔧.*\)\s*$/,  // 初始化日志
  /^\s*console\.log\('💾.*\)\s*$/,  // 状态日志
  /^\s*console\.log\('📅.*\)\s*$/,  // 日期日志
  /^\s*console\.log\('⏭️.*\)\s*$/,  // 跳过日志
  /^\s*console\.log\('📦 使用缓存.*\)\s*$/,  // 缓存日志
  /^\s*console\.log\('   缓存大小.*\)\s*$/,  // 缓存详情
];

// 要保留的日志模式
const patternsToKeep = [
  /console\.error/,  // 错误日志
  /console\.warn/,   // 警告日志
  /console\.log\('✅/,  // 成功日志
  /console\.log\('❌/,  // 失败日志
];

function shouldRemoveLine(line) {
  // 保留的模式不删除
  for (const pattern of patternsToKeep) {
    if (pattern.test(line)) {
      return false;
    }
  }
  
  // 匹配删除模式
  for (const pattern of patternsToRemove) {
    if (pattern.test(line)) {
      return true;
    }
  }
  
  return false;
}

function cleanFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️ 文件不存在，跳过: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const originalCount = lines.length;
  
  // 过滤行
  const filteredLines = lines.filter(line => !shouldRemoveLine(line));
  const removedCount = originalCount - filteredLines.length;
  
  if (removedCount > 0) {
    fs.writeFileSync(fullPath, filteredLines.join('\n'), 'utf-8');
    console.log(`✅ 已清理 ${filePath}: 删除 ${removedCount} 行日志`);
  } else {
    console.log(`ℹ️  ${filePath}: 无需清理`);
  }
}

function main() {
  console.log('🧹 开始清理调试日志...\n');
  
  let totalRemoved = 0;
  
  for (const file of filesToClean) {
    cleanFile(file);
  }
  
  console.log('\n✅ 清理完成！');
  console.log('\n提示：运行 npm run dev 查看效果');
  console.log('如果需要恢复，请使用 git checkout 恢复文件');
}

main();



