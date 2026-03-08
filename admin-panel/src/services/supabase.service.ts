import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量必须设置');
  console.error('当前 SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
  console.error('当前 SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '已设置' : '未设置');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 导出管理客户端（用于 Auth 操作）
export const supabaseAuth = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!);