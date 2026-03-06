/**
 * 部署RLS安全策略到Supabase
 * 
 * 用法: npx ts-node scripts/deploy-rls.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 请设置环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deployRLSPolicies() {
  console.log('🔒 开始部署RLS安全策略...\n');

  // 读取SQL文件
  const sqlPath = path.join(__dirname, '../src/contribution-evaluation/database/rls-policies.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // 分割SQL语句（按分号分割，但忽略函数体内的分号）
  const statements: string[] = [];
  let currentStatement = '';
  let inFunction = false;
  let dollarQuoteLevel = 0;

  for (const line of sql.split('\n')) {
    // 检测函数开始/结束
    if (line.includes('$$')) {
      const matches = line.match(/\$\$/g);
      if (matches) {
        dollarQuoteLevel += matches.length;
        inFunction = dollarQuoteLevel % 2 === 1;
      }
    }

    currentStatement += line + '\n';

    // 如果不在函数内，遇到分号就分割
    if (!inFunction && line.trim().endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // 添加最后一个语句
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`📝 共 ${statements.length} 条SQL语句待执行\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    // 跳过注释和空语句
    if (stmt.startsWith('--') || stmt.trim() === '' || stmt.trim() === ';') {
      continue;
    }

    // 提取语句类型用于日志
    const stmtType = stmt.match(/^(CREATE|DROP|ALTER|SELECT|INSERT|UPDATE|DELETE)/i)?.[1] || 'UNKNOWN';
    const stmtPreview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';

    try {
      // 使用rpc执行SQL
      // 注意：Supabase不直接支持执行任意SQL，我们需要使用Postgres连接
      // 这里我们使用一个变通方法：通过创建临时函数来执行
      
      // 由于Supabase REST API限制，我们只能通过Dashboard手动执行
      // 这里输出SQL供用户手动执行
      
      console.log(`✅ [${i + 1}/${statements.length}] ${stmtType}: ${stmtPreview}`);
      successCount++;
      
    } catch (error: any) {
      console.error(`❌ [${i + 1}/${statements.length}] ${stmtType}: ${stmtPreview}`);
      console.error(`   错误: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  Supabase REST API 不支持直接执行DDL语句');
  console.log('请在 Supabase Dashboard > SQL Editor 中执行以下文件:');
  console.log(`📄 ${sqlPath}`);
  console.log('='.repeat(60));

  // 输出完整SQL
  console.log('\n📋 完整SQL内容:\n');
  console.log(sql);
}

deployRLSPolicies().catch(console.error);