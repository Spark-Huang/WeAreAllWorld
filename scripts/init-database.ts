/**
 * 数据库初始化脚本
 * 
 * 使用方法：
 * npm run db:init
 * 
 * 或者直接运行：
 * npx ts-node scripts/init-database.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

async function initDatabase() {
  console.log('========================================');
  console.log('  共生世界 - 数据库初始化');
  console.log('========================================\n');
  
  if (!SUPABASE_URL) {
    console.error('❌ 请设置 SUPABASE_URL 环境变量');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('正在初始化数据库...\n');
  
  // 读取SQL文件
  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const functionsPath = path.join(__dirname, '../src/database/functions.sql');
  const triggersPath = path.join(__dirname, '../src/database/triggers.sql');
  
  console.log('1. 创建表结构...');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  
  // 注意：Supabase 不支持直接执行多条SQL语句
  // 需要通过 Supabase Dashboard 的 SQL Editor 执行
  // 或者使用 Supabase CLI
  
  console.log('\n========================================');
  console.log('⚠️  重要提示');
  console.log('========================================');
  console.log('\nSupabase 不支持通过 API 直接执行 DDL 语句。');
  console.log('请按以下步骤手动初始化数据库：\n');
  console.log('1. 打开 Supabase Dashboard');
  console.log('   https://supabase.com/dashboard/project/kmbmfzehpjjctvuagecd\n');
  console.log('2. 进入 SQL Editor\n');
  console.log('3. 按顺序执行以下SQL文件：');
  console.log('   - src/database/schema.sql (表结构)');
  console.log('   - src/database/functions.sql (函数)');
  console.log('   - src/database/triggers.sql (触发器)\n');
  console.log('4. 或者使用 Supabase CLI:');
  console.log('   supabase db push\n');
  console.log('========================================\n');
  
  // 输出SQL内容供复制
  console.log('===== schema.sql 内容 =====\n');
  console.log(schemaSql.substring(0, 2000) + '\n... (请查看完整文件)\n');
  
  console.log('\n✅ 数据库初始化脚本准备完成！');
  console.log('   请按照上述步骤在 Supabase Dashboard 中执行 SQL。\n');
}

initDatabase().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});