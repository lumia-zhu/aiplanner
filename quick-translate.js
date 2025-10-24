// 快速翻译脚本 - 只替换最常见且安全的词汇
const fs = require('fs');
const path = require('path');

// 只包含最安全、最常见的翻译
const safeTranslations = {
  // 完整短语优先
  '确定要删除': 'Are you sure you want to delete',
  '请输入': 'Please enter',
  '输入': 'Enter',
  '选择': 'Select',
  '加载中...': 'Loading...',
  '保存中...': 'Saving...',
  '删除中...': 'Deleting...',
  '创建中...': 'Creating...',
  '更新中...': 'Updating...',
  '登录中...': 'Logging in...',
  '注册中...': 'Registering...',
  
  // 单词
  '保存': 'Save',
  '取消': 'Cancel', 
  '删除': 'Delete',
  '编辑': 'Edit',
  '确认': 'Confirm',
  '提交': 'Submit',
  '创建': 'Create',
  '更新': 'Update',
  '添加': 'Add',
  '关闭': 'Close',
  '展开': 'Expand',
  '收起': 'Collapse',
  '完成': 'Complete',
  '未完成': 'Incomplete',
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  const sorted = Object.entries(safeTranslations).sort((a, b) => b[0].length - a[0].length);
  
  for (const [cn, en] of sorted) {
    const patterns = [
      new RegExp(`'${escapeRegex(cn)}'`, 'g'),
      new RegExp(`"${escapeRegex(cn)}"`, 'g'),
      new RegExp(`\`${escapeRegex(cn)}\``, 'g'),
    ];
    
    for (const p of patterns) {
      const quote = p.source[0];
      content = content.replace(p, `${quote}${en}${quote}`);
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  return false;
}

const files = process.argv.slice(2);
let count = 0;

if (files.length === 0) {
  console.log('用法: node quick-translate.js <file1> <file2> ...');
  process.exit(1);
}

console.log('🚀 快速翻译中...\n');
for (const file of files) {
  if (translateFile(file)) count++;
}

console.log(`\n✅ 完成！翻译了 ${count} 个文件`);


