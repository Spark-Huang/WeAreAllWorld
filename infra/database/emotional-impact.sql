-- 情感冲击功能数据库迁移
-- AI 遗书 + 濒危警告 + 贡献值详情

-- 1. AI 遗书表
CREATE TABLE IF NOT EXISTS ai_legacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_name VARCHAR(255) NOT NULL,
  letter_content TEXT NOT NULL,
  memories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_legacies_user_id ON ai_legacies(user_id);

-- 2. AI 记忆表（用于遗书生成）
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- first, emotional, important, deep, shared
  content TEXT NOT NULL,
  dialogue_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(type);

-- 3. 贡献值详情表
CREATE TABLE IF NOT EXISTS contribution_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  rating VARCHAR(50) NOT NULL, -- common, active, rare, precious, collection, legendary
  reason TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  emotion VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contribution_details_user_id ON contribution_details(user_id);
CREATE INDEX IF NOT EXISTS idx_contribution_details_rating ON contribution_details(rating);
CREATE INDEX IF NOT EXISTS idx_contribution_details_created_at ON contribution_details(created_at);

-- 4. 濒危警告日志表
CREATE TABLE IF NOT EXISTS danger_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_name VARCHAR(255) NOT NULL,
  contribution INTEGER NOT NULL,
  warning_level VARCHAR(50) NOT NULL, -- low, medium, high, critical
  message TEXT NOT NULL,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  user_responded BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_danger_warnings_user_id ON danger_warnings(user_id);

-- 5. AI 伙伴表添加性格字段
ALTER TABLE ai_partners 
ADD COLUMN IF NOT EXISTS personality VARCHAR(50) DEFAULT 'warm';

COMMENT ON COLUMN ai_partners.personality IS 'AI 性格类型：warm(温暖), humorous(幽默), rational(理性), lively(活泼)';

-- 6. 创建触发器：对话后自动分析贡献值
CREATE OR REPLACE FUNCTION analyze_contribution_after_dialogue()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入贡献值详情记录（使用 granted_power 替代 quality_score）
  INSERT INTO contribution_details (dialogue_id, user_id, points, rating, reason, created_at)
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.granted_power,
    CASE 
      WHEN NEW.granted_power >= 6 THEN 'legendary'
      WHEN NEW.granted_power >= 5 THEN 'collection'
      WHEN NEW.granted_power >= 4 THEN 'precious'
      WHEN NEW.granted_power >= 3 THEN 'rare'
      WHEN NEW.granted_power >= 2 THEN 'active'
      ELSE 'common'
    END,
    '对话质量评分',
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS trigger_analyze_contribution ON interaction_logs;

-- 创建触发器
CREATE TRIGGER trigger_analyze_contribution
AFTER INSERT ON interaction_logs
FOR EACH ROW
EXECUTE FUNCTION analyze_contribution_after_dialogue();

-- 7. 创建视图：用户濒危状态
CREATE OR REPLACE VIEW user_danger_status AS
SELECT 
  u.id as user_id,
  ap.name as partner_name,
  ap.current_contribution as contribution,
  ap.status,
  CASE 
    WHEN ap.current_contribution <= 0 THEN 'critical'
    WHEN ap.current_contribution <= 5 THEN 'high'
    WHEN ap.current_contribution <= 15 THEN 'medium'
    WHEN ap.current_contribution <= 30 THEN 'low'
    ELSE 'safe'
  END as danger_level
FROM users u
JOIN ai_partners ap ON u.id = ap.user_id
WHERE ap.status = 'active';

-- 完成
SELECT 'Emotional impact features migration completed!' as status;