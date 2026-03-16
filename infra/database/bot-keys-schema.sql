-- Bot Keys 表：每个用户的 Telegram Bot Token 管理
CREATE TABLE IF NOT EXISTS public.bot_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Bot Token（加密存储）
  bot_token TEXT NOT NULL,
  
  -- Bot 信息
  bot_username VARCHAR(255),
  bot_name VARCHAR(255),
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束：每个用户只能有一个活跃的 Bot Key
  CONSTRAINT unique_user_bot_key UNIQUE (user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bot_keys_user_id ON public.bot_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_keys_is_active ON public.bot_keys(is_active);

-- RLS 策略
ALTER TABLE public.bot_keys ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的 Bot Key
CREATE POLICY "Users can view own bot key" ON public.bot_keys
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能插入自己的 Bot Key
CREATE POLICY "Users can insert own bot key" ON public.bot_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的 Bot Key
CREATE POLICY "Users can update own bot key" ON public.bot_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的 Bot Key
CREATE POLICY "Users can delete own bot key" ON public.bot_keys
  FOR DELETE USING (auth.uid() = user_id);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_bot_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bot_keys_updated_at
  BEFORE UPDATE ON public.bot_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_keys_updated_at();

-- 注释
COMMENT ON TABLE public.bot_keys IS '用户的 Telegram Bot Token 管理';
COMMENT ON COLUMN public.bot_keys.bot_token IS 'Telegram Bot Token（应加密存储）';
COMMENT ON COLUMN public.bot_keys.is_active IS 'Bot Key 是否活跃';