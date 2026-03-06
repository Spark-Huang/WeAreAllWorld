/**
 * 部署RLS安全策略到Supabase (使用Postgres直接连接)
 * 
 * 用法: 
 *   1. 设置环境变量: SUPABASE_DB_URL (postgres连接字符串)
 *   2. npx ts-node scripts/deploy-rls-pg.ts
 * 
 * 获取DB URL: Supabase Dashboard > Settings > Database > Connection string > JDBC
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Supabase Postgres连接URL
// 格式: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('❌ 请设置环境变量: SUPABASE_DB_URL');
  console.error('\n获取方法:');
  console.error('1. 打开 Supabase Dashboard');
  console.error('2. 进入 Settings > Database');
  console.error('3. 复制 Connection string (URI) - 使用 Transaction 模式');
  console.error('4. 格式: postgresql://postgres.[ref]:[password]@...');
  process.exit(1);
}

async function deployRLSPolicies() {
  console.log('🔒 开始部署RLS安全策略...\n');

  const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../src/contribution-evaluation/database/rls-policies.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 执行SQL文件: rls-policies.sql\n');

    // 执行整个SQL文件
    await pool.query(sql);

    console.log('✅ RLS安全策略部署成功！\n');

    // 验证策略
    console.log('🔍 验证RLS策略...\n');

    const { rows: policies } = await pool.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    console.log('已创建的策略:');
    for (const policy of policies) {
      console.log(`  - ${policy.tablename}.${policy.policyname} (${policy.cmd})`);
    }

    console.log(`\n📊 共 ${policies.length} 条RLS策略已生效`);

  } catch (error: any) {
    console.error('❌ 部署失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

deployRLSPolicies().catch(() => process.exit(1));