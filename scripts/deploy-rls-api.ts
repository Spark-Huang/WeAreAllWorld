/**
 * 使用Supabase REST API部署RLS策略
 * 
 * 用法: 
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx npx ts-node scripts/deploy-rls-api.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 请设置环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function executeSQL(sql: string): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API错误: ${response.status} - ${text}`);
  }

  return response.json();
}

async function deployRLS() {
  console.log('🔒 开始部署RLS安全策略...\n');

  // 读取SQL文件
  const sqlPath = path.join(__dirname, '../src/contribution-evaluation/database/rls-policies.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('📄 执行SQL文件: rls-policies.sql');
  console.log(`   文件大小: ${(sql.length / 1024).toFixed(2)} KB\n`);

  try {
    // 分段执行（Supabase可能对单次请求有限制）
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    console.log(`📝 共 ${statements.length} 条SQL语句待执行\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      try {
        await executeSQL(stmt + ';');
        success++;
        process.stdout.write(`\r✅ 进度: ${i + 1}/${statements.length} (成功: ${success}, 失败: ${failed})`);
      } catch (e: any) {
        // 忽略"policy already exists"等非致命错误
        if (e.message.includes('already exists') || e.message.includes('does not exist')) {
          success++;
        } else {
          failed++;
          console.log(`\n❌ 语句 ${i + 1} 失败: ${e.message.substring(0, 100)}`);
        }
      }
    }

    console.log(`\n\n📊 执行完成: 成功 ${success}, 失败 ${failed}`);

  } catch (error: any) {
    console.error('❌ 部署失败:', error.message);
    console.log('\n💡 请手动在Supabase Dashboard中执行SQL:');
    console.log('   1. 打开 https://supabase.com/dashboard');
    console.log('   2. 选择项目 → SQL Editor');
    console.log('   3. 复制并执行: src/contribution-evaluation/database/rls-policies.sql');
    process.exit(1);
  }
}

deployRLS();