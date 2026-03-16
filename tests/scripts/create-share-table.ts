import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTable() {
  console.log('创建 share_records 表...');
  
  // 使用 raw SQL 通过 rpc
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS share_records (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        share_type VARCHAR(20) NOT NULL,
        share_platform VARCHAR(20) NOT NULL,
        share_content JSONB NOT NULL,
        contribution_reward INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  });
  
  if (error) {
    console.log('RPC 方式失败，尝试直接插入测试数据来创建表...');
    
    // 如果 rpc 不存在，我们需要手动在 Supabase Dashboard 创建表
    console.log('\n请在 Supabase Dashboard 执行以下 SQL:');
    console.log('---');
    console.log(`
CREATE TABLE IF NOT EXISTS share_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(20) NOT NULL,
    share_platform VARCHAR(20) NOT NULL,
    share_content JSONB NOT NULL,
    contribution_reward INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_records_user_id ON share_records(user_id);
CREATE INDEX IF NOT EXISTS idx_share_records_created_at ON share_records(created_at);

ALTER TABLE share_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的分享记录" ON share_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "服务端可以插入分享记录" ON share_records
    FOR INSERT WITH CHECK (true);
    `);
    console.log('---');
  } else {
    console.log('表创建成功！');
  }
}

createTable();
