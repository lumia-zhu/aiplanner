// Supabase 配置测试脚本
require('dotenv').config({ path: '.env.local' });

const config = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

console.log('\n🔍 Supabase 配置检查\n' + '='.repeat(50));

// 检查 URL
if (!config.url || config.url === 'your_supabase_project_url') {
  console.log('❌ NEXT_PUBLIC_SUPABASE_URL 未配置或使用默认值');
} else if (config.url.includes('supabase.co')) {
  console.log('✅ NEXT_PUBLIC_SUPABASE_URL 已配置');
  console.log(`   ${config.url}`);
} else {
  console.log('⚠️  NEXT_PUBLIC_SUPABASE_URL 格式可能不正确');
  console.log(`   ${config.url}`);
}

// 检查 Key
if (!config.key || config.key === 'your_supabase_anon_key') {
  console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置或使用默认值');
} else if (config.key.startsWith('eyJ') || config.key.startsWith('sb_')) {
  console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY 已配置');
  console.log(`   ${config.key.substring(0, 20)}...`);
} else {
  console.log('⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY 格式可能不正确');
}

console.log('='.repeat(50));

if (config.url && config.key && 
    config.url !== 'your_supabase_project_url' && 
    config.key !== 'your_supabase_anon_key') {
  console.log('\n🎉 配置看起来正确！可以运行 npm run dev 测试了\n');
} else {
  console.log('\n⚠️  请检查 .env.local 文件并填入正确的值\n');
}





