-- 用户粘性功能数据库迁移
-- 连续登录奖励 + 深度对话 + 记忆博物馆

-- 1. 登录记录表
CREATE TABLE IF NOT EXISTS login_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  streak_at_login INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, login_date)
);

CREATE INDEX IF NOT EXISTS idx_login_records_user_id ON login_records(user_id);
CREATE INDEX IF NOT EXISTS idx_login_records_date ON login_records(login_date);

-- 2. 用户表添加登录相关字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0;

COMMENT ON COLUMN users.last_login IS '最后登录时间';
COMMENT ON COLUMN users.login_streak IS '当前连续登录天数';
COMMENT ON COLUMN users.max_streak IS '最高连续登录天数';

-- 3. 深度对话记录表
CREATE TABLE IF NOT EXISTS deep_dialogue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  content TEXT,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deep_dialogue_user_id ON deep_dialogue_records(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_dialogue_prompt ON deep_dialogue_records(prompt_id);

-- 4. 用户偏好表
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  preferred_topics TEXT[] DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- 5. AI 记忆表（如果不存在）
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  dialogue_id UUID,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_created_at ON ai_memories(created_at);

-- 6. 触发器：自动创建用户偏好
CREATE OR REPLACE FUNCTION create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_user_preferences ON users;
CREATE TRIGGER trigger_create_user_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_preferences();

-- 7. 视图：用户登录统计
CREATE OR REPLACE VIEW user_login_stats AS
SELECT 
  u.id as user_id,
  u.login_streak,
  u.max_streak,
  u.last_login,
  COUNT(lr.id) as total_logins,
  SUM(lr.points_earned) as total_login_points
FROM users u
LEFT JOIN login_records lr ON u.id = lr.user_id
GROUP BY u.id, u.login_streak, u.max_streak, u.last_login;

-- 8. 视图：记忆统计
CREATE OR REPLACE VIEW memory_stats AS
SELECT 
  user_id,
  COUNT(*) as total_memories,
  COUNT(CASE WHEN type = 'first' THEN 1 END) as first_memories,
  COUNT(CASE WHEN type = 'emotional' THEN 1 END) as emotional_memories,
  COUNT(CASE WHEN type = 'important' THEN 1 END) as important_memories,
  COUNT(CASE WHEN type = 'deep' THEN 1 END) as deep_memories,
  COUNT(CASE WHEN type = 'shared' THEN 1 END) as shared_memories,
  MIN(created_at) as oldest_memory,
  MAX(created_at) as newest_memory
FROM ai_memories
GROUP BY user_id;

-- 完成
SELECT 'Engagement features migration completed!' as status;