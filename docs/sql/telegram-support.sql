-- Telegram 支持数据库迁移
-- 添加 telegram_id 字段和相关索引

-- 1. 添加 telegram_id 字段到 users 表
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkin_streak INTEGER DEFAULT 0;

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- 3. 添加注释
COMMENT ON COLUMN users.telegram_id IS 'Telegram 用户 ID';
COMMENT ON COLUMN users.telegram_username IS 'Telegram 用户名';
COMMENT ON COLUMN users.last_checkin IS '最后签到时间';
COMMENT ON COLUMN users.checkin_streak IS '连续签到天数';

-- 4. 创建 Telegram 用户视图
CREATE OR REPLACE VIEW telegram_users AS
SELECT 
  u.id,
  u.telegram_id,
  u.telegram_username,
  u.contribution,
  u.checkin_streak,
  u.last_checkin,
  ap.name as partner_name,
  ap.status as partner_status
FROM users u
LEFT JOIN ai_partners ap ON u.id = ap.user_id
WHERE u.telegram_id IS NOT NULL;

-- 5. 添加签到记录表
CREATE TABLE IF NOT EXISTS checkin_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  points_earned INTEGER NOT NULL,
  streak_at_checkin INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkin_records_user_id ON checkin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(checkin_date);

-- 完成
SELECT 'Telegram support migration completed!' as status;