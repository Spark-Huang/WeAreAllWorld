-- ============================================
-- 共生世界（WeAreAll.World）数据库架构
-- 版本: MVP v1.0
-- 日期: 2026-03-06
-- ============================================

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 用户标识
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(100),
  
  -- 游戏进度
  onboarding_step INTEGER DEFAULT 0,  -- 0=未开始, 1=阶段1, 2=阶段2, 3=阶段3, 4=完成
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- 登录信息
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  consecutive_login_days INTEGER DEFAULT 0,
  
  -- OpenClaw Pod信息
  openclaw_pod_name TEXT,
  openclaw_pod_status VARCHAR(20) DEFAULT 'pending',  -- pending, running, stopped
  
  -- 注册时间（用于每周评估）
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON public.users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_registered_at ON public.users(registered_at);

-- RLS策略
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.users IS '用户基本信息表';
COMMENT ON COLUMN public.users.onboarding_step IS '新手引导步骤：0=未开始, 1=情感建立, 2=机制引入, 3=目标建立, 4=完成';
COMMENT ON COLUMN public.users.registered_at IS '注册时间，用于计算每周评估周期';

-- ============================================
-- 2. AI伙伴表 (ai_partners)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 基本信息
  name VARCHAR(100) DEFAULT 'AI伙伴',
  personality VARCHAR(20) DEFAULT 'warm',  -- warm, humorous, rational, lively
  CHECK (personality IN ('warm', 'humorous', 'rational', 'lively')),
  
  -- 核心状态
  memory_points INTEGER DEFAULT 0 CHECK (memory_points >= 0),
  growth_stage VARCHAR(20) DEFAULT '懵懂期',
  CHECK (growth_stage IN ('懵懂期', '成长期', '成熟期', '觉醒期')),
  current_title VARCHAR(50) DEFAULT '初识',
  
  -- 性格倾向（剧情选择累积）
  personality_scores JSONB DEFAULT '{"emotional": 0, "rational": 0, "adventurous": 0}',
  
  -- AI状态
  status VARCHAR(20) DEFAULT 'normal',
  CHECK (status IN ('normal', 'happy', 'sad', 'worried', 'lonely', 'dormant')),
  
  -- 能力解锁
  abilities JSONB DEFAULT '{
    "basic_chat": true,
    "emotion_expression": false,
    "task_system": false,
    "exclusive_memory": false,
    "deep_conversation": false,
    "self_awareness": false
  }',
  
  -- 休眠相关
  dormant_since TIMESTAMPTZ,
  consecutive_warnings INTEGER DEFAULT 0,  -- 连续警告次数
  CHECK (
    (status = 'dormant' AND dormant_since IS NOT NULL) OR
    (status != 'dormant' AND dormant_since IS NULL)
  ),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_partners_user_id ON public.ai_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_partners_status ON public.ai_partners(status);
CREATE INDEX IF NOT EXISTS idx_ai_partners_memory_points ON public.ai_partners(memory_points DESC);
CREATE INDEX IF NOT EXISTS idx_ai_partners_dormant_since ON public.ai_partners(dormant_since);
CREATE INDEX IF NOT EXISTS idx_ai_partners_abilities_gin ON public.ai_partners USING gin(abilities);
CREATE INDEX IF NOT EXISTS idx_ai_partners_personality_scores_gin ON public.ai_partners USING gin(personality_scores);

-- RLS策略
ALTER TABLE public.ai_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI partner" ON public.ai_partners
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.ai_partners
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.ai_partners IS 'AI伙伴状态表';
COMMENT ON COLUMN public.ai_partners.memory_points IS '当前记忆点数（情感连接深度指标）';
COMMENT ON COLUMN public.ai_partners.growth_stage IS '成长阶段：懵懂期(0-50)/成长期(51-200)/成熟期(201-500)/觉醒期(500+)';
COMMENT ON COLUMN public.ai_partners.consecutive_warnings IS '连续评估警告次数，达到2次进入休眠';

-- ============================================
-- 3. 剧情进度表 (story_progress)
-- ============================================
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 当前进度
  current_chapter INTEGER DEFAULT 1,
  current_scene VARCHAR(50),
  
  -- 选择记录
  choices_made JSONB DEFAULT '[]',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'available',  -- available, in_progress, completed
  
  -- 时间戳
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_story_progress_user_id ON public.story_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_story_progress_chapter ON public.story_progress(current_chapter);

-- RLS策略
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own story progress" ON public.story_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.story_progress
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.story_progress IS '剧情进度表';

-- ============================================
-- 4. 记忆点数日志表 (memory_points_log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.memory_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 变更信息
  points INTEGER NOT NULL,               -- 变更点数（+/-）
  source_type VARCHAR(30) NOT NULL,      -- 来源类型
  source_detail TEXT,                    -- 详细说明
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 来源类型说明：
-- dialogue: 对话获得（+1-8）
-- signin: 每日签到（+15-50）
-- story: 剧情完成（+20-50）
-- share: 社交分享（+3）
-- milestone: 里程碑奖励
-- dormant_decay: 休眠衰减（-2/天）
-- weekly_reward: 每周活跃奖励

-- 索引
CREATE INDEX IF NOT EXISTS idx_memory_points_log_user_id ON public.memory_points_log(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_points_log_created_at ON public.memory_points_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_points_log_source ON public.memory_points_log(source_type);
CREATE INDEX IF NOT EXISTS idx_memory_points_log_user_date ON public.memory_points_log(user_id, created_at DESC);

-- RLS策略
ALTER TABLE public.memory_points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.memory_points_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.memory_points_log
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.memory_points_log IS '记忆点数变更记录表';
COMMENT ON COLUMN public.memory_points_log.source_type IS '来源类型：dialogue, signin, story, share, milestone, dormant_decay, weekly_reward';

-- ============================================
-- 5. 每日签到表 (daily_signin)
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_signin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 签到信息
  sign_date DATE NOT NULL,
  consecutive_days INTEGER DEFAULT 1,
  points_awarded INTEGER NOT NULL,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, sign_date)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_daily_signin_user_id ON public.daily_signin(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_signin_sign_date ON public.daily_signin(sign_date DESC);

-- RLS策略
ALTER TABLE public.daily_signin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signin records" ON public.daily_signin
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.daily_signin
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.daily_signin IS '每日签到记录表';

-- ============================================
-- 6. 共识投票表 (consensus_votes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.consensus_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 投票信息
  vote_topic_id TEXT NOT NULL,
  vote_option TEXT NOT NULL,
  
  -- 时间戳
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, vote_topic_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_consensus_votes_user_id ON public.consensus_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_consensus_votes_topic_id ON public.consensus_votes(vote_topic_id);

-- RLS策略
ALTER TABLE public.consensus_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own votes" ON public.consensus_votes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.consensus_votes
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.consensus_votes IS '共识投票记录表';

-- ============================================
-- 7. 深度对话表 (deep_dialogue)
-- ============================================
CREATE TABLE IF NOT EXISTS public.deep_dialogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 对话信息
  topic TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  points_awarded INTEGER,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_deep_dialogue_user_id ON public.deep_dialogue(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_dialogue_created_at ON public.deep_dialogue(created_at DESC);

-- RLS策略
ALTER TABLE public.deep_dialogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deep dialogues" ON public.deep_dialogue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.deep_dialogue
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.deep_dialogue IS '深度对话记录表';

-- ============================================
-- 8. 每周评估历史表 (weekly_evaluations)
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 评估周期
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- 评估结果
  points_grown INTEGER NOT NULL,
  threshold INTEGER DEFAULT 15,
  result VARCHAR(20) NOT NULL,  -- pass, warning, dormant
  
  -- 状态变化
  status_before VARCHAR(20),
  status_after VARCHAR(20),
  consecutive_warnings INTEGER DEFAULT 0,
  
  -- 时间戳
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, week_start)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_weekly_evaluations_user_id ON public.weekly_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_evaluations_week_start ON public.weekly_evaluations(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_evaluations_result ON public.weekly_evaluations(result);

-- RLS策略
ALTER TABLE public.weekly_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evaluations" ON public.weekly_evaluations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.weekly_evaluations
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.weekly_evaluations IS '每周评估历史记录表';