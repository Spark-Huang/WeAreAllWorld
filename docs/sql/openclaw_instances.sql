-- OpenClaw 实例表
-- 在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS openclaw_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pod_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_openclaw_instances_user_id ON openclaw_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_instances_status ON openclaw_instances(status);

-- 启用 RLS
ALTER TABLE openclaw_instances ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的实例
CREATE POLICY "Users can view own instance" ON openclaw_instances
  FOR SELECT USING (auth.uid() = user_id);

-- RLS 策略：服务端可以管理所有实例
CREATE POLICY "Service role can manage all" ON openclaw_instances
  FOR ALL USING (auth.role() = 'service_role');

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER openclaw_instances_updated_at
  BEFORE UPDATE ON openclaw_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();