-- ============================================
-- 大同世界（WeAreAll.World）数据库架构 v2.1
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
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- 登录信息
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  consecutive_login_days INTEGER DEFAULT 0,
  
  -- OpenClaw Pod信息
  openclaw_pod_name TEXT,
  openclaw_pod_status VARCHAR(20) DEFAULT 'pending',
  
  -- 难度设置（MVP只用标准模式）
  difficulty_mode VARCHAR(20) DEFAULT 'standard',
  
  -- 免费唤醒次数
  free_wakeup_count INTEGER DEFAULT 1,
  
  -- 注册时间（用于每周评估）
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON public.users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_registered_at ON public.users(registered_at);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.users IS '用户基本信息表';
COMMENT ON COLUMN public.users.difficulty_mode IS '难度模式：easy(≥5点), standard(≥15点), hard(≥45点)';
COMMENT ON COLUMN public.users.free_wakeup_count IS '免费唤醒次数，每个用户初始有1次';

-- ============================================
-- 2. AI伙伴表 (ai_partners) - v2.1更新
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 基本信息
  name VARCHAR(50) DEFAULT 'AI伙伴',
  personality VARCHAR(20) DEFAULT 'warm',
  CHECK (personality IN ('warm', 'humorous', 'rational', 'lively')),
  
  -- 核心状态 - v2.1更新
  total_contribution INTEGER DEFAULT 0 CHECK (total_contribution >= 0),
  current_contribution INTEGER DEFAULT 0 CHECK (current_contribution >= 0),
  weekly_contribution INTEGER DEFAULT 0 CHECK (weekly_contribution >= 0),
  
  -- 成长阶段
  growth_stage VARCHAR(20) DEFAULT '懵懂期',
  CHECK (growth_stage IN ('懵懂期', '成长期', '成熟期', '觉醒期')),
  current_title VARCHAR(50) DEFAULT '初识',
  
  -- 性格倾向（剧情选择累积）
  personality_scores JSONB DEFAULT '{"emotional": 0, "rational": 0, "adventurous": 0}',
  
  -- AI状态 - v2.1更新
  status VARCHAR(20) DEFAULT 'active',
  CHECK (status IN ('active', 'hibernated', 'recycled')),
  
  -- 能力解锁
  abilities JSONB DEFAULT '{
    "basic_chat": true,
    "emotion_expression": false,
    "task_system": false,
    "exclusive_memory": false,
    "deep_conversation": false,
    "self_awareness": false
  }',
  
  -- 休眠相关 - v2.1更新
  hibernated_since TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_partners_user_id ON public.ai_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_partners_status ON public.ai_partners(status);
CREATE INDEX IF NOT EXISTS idx_ai_partners_total_contribution ON public.ai_partners(total_contribution DESC);
CREATE INDEX IF NOT EXISTS idx_ai_partners_hibernated_since ON public.ai_partners(hibernated_since);

ALTER TABLE public.ai_partners ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_partners IS 'AI伙伴状态表 v2.1';
COMMENT ON COLUMN public.ai_partners.total_contribution IS '累计总贡献值（只增不减，用于里程碑）';
COMMENT ON COLUMN public.ai_partners.current_contribution IS '当前贡献值（休眠会扣除）';
COMMENT ON COLUMN public.ai_partners.weekly_contribution IS '本周新增贡献值（评估核算用，每周重置）';
COMMENT ON COLUMN public.ai_partners.violation_count IS '连续未达标周数，达到2次进入休眠';

-- ============================================
-- 3. 交互质量日志表 (interaction_logs) - 新增
-- ============================================
CREATE TABLE IF NOT EXISTS public.interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 消息标识（脱敏）
  message_hash VARCHAR(255),
  
  -- 质量判定结果
  category VARCHAR(50) NOT NULL,
  granted_power INTEGER NOT NULL,
  data_rarity VARCHAR(50),
  
  -- LLM详细判定结果
  ai_understanding JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 数据稀缺度评级说明：
-- 普通数据: greeting(1点)
-- 活跃数据: daily(2点)
-- [稀有·真实情感图谱]: emotion(3点)
-- [珍贵·人类行为样本]: experience(4点)
-- [典藏级·人类独有思维特征]: deep_thought(5点)
-- [绝版·专属生命记忆]: special_memory(6-8点)

CREATE INDEX IF NOT EXISTS idx_interaction_logs_user_id ON public.interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON public.interaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_category ON public.interaction_logs(category);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_rarity ON public.interaction_logs(data_rarity);

ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.interaction_logs IS '交互质量与数据资产池';
COMMENT ON COLUMN public.interaction_logs.data_rarity IS '数据稀缺度评级';

-- ============================================
-- 4. 中央评估审计流水表 (central_evaluations) - 新增
-- ============================================
CREATE TABLE IF NOT EXISTS public.central_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 评估周期
  evaluation_cycle_start TIMESTAMPTZ NOT NULL,
  evaluation_cycle_end TIMESTAMPTZ NOT NULL,
  
  -- 评估结果
  required_power INTEGER DEFAULT 15,
  achieved_power INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  
  -- 执行动作
  action_taken VARCHAR(50) NOT NULL,
  -- none: 无需操作
  -- warned: 警告（第一次不通过）
  -- hibernated: 进入休眠
  -- decayed: 衰减
  -- recycled: 回收
  
  -- 状态变化
  status_before VARCHAR(20),
  status_after VARCHAR(20),
  violation_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_evaluations_user_id ON public.central_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_central_evaluations_cycle ON public.central_evaluations(evaluation_cycle_start, evaluation_cycle_end);
CREATE INDEX IF NOT EXISTS idx_central_evaluations_action ON public.central_evaluations(action_taken);

ALTER TABLE public.central_evaluations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.central_evaluations IS '中央评估审计流水表';
COMMENT ON COLUMN public.central_evaluations.action_taken IS '执行动作：none, warned, hibernated, decayed, recycled';

-- ============================================
-- 5. 剧情进度表 (story_progress) - v2.2更新
-- ============================================
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 当前进度
  current_chapter INTEGER DEFAULT 1,
  current_scene VARCHAR(50) DEFAULT 'ch1_scene1',
  
  -- 已完成章节
  completed_chapters JSONB DEFAULT '[]',
  
  -- 选择记录
  choices_made JSONB DEFAULT '[]',
  
  -- 累计奖励
  total_rewards INTEGER DEFAULT 0,
  
  -- 状态
  status VARCHAR(20) DEFAULT 'available',
  CHECK (status IN ('available', 'locked', 'completed')),
  
  -- 时间戳
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_progress_user_id ON public.story_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_story_progress_status ON public.story_progress(status);

ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.story_progress IS '剧情进度表 v2.2';
COMMENT ON COLUMN public.story_progress.completed_chapters IS '已完成的章节ID列表';
COMMENT ON COLUMN public.story_progress.total_rewards IS '剧情累计获得的贡献值奖励';

-- ============================================
-- 6. 每日签到表 (daily_signin)
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

CREATE INDEX IF NOT EXISTS idx_daily_signin_user_id ON public.daily_signin(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_signin_sign_date ON public.daily_signin(sign_date DESC);

ALTER TABLE public.daily_signin ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.daily_signin IS '每日签到记录表';

-- ============================================
-- 7. 共识投票表 (consensus_votes)
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

CREATE INDEX IF NOT EXISTS idx_consensus_votes_user_id ON public.consensus_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_consensus_votes_topic_id ON public.consensus_votes(vote_topic_id);

ALTER TABLE public.consensus_votes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.consensus_votes IS '共识投票记录表';

-- ============================================
-- 8. 深度对话表 (deep_dialogue)
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

CREATE INDEX IF NOT EXISTS idx_deep_dialogue_user_id ON public.deep_dialogue(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_dialogue_created_at ON public.deep_dialogue(created_at DESC);

ALTER TABLE public.deep_dialogue ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.deep_dialogue IS '深度对话记录表';

-- ============================================
-- 9. 每周奖励表 (weekly_rewards)
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 奖励周期
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- 活跃度等级
  activity_level VARCHAR(20) NOT NULL,  -- basic, active, deep
  points_earned INTEGER NOT NULL,
  
  -- 奖励内容
  bonus_points INTEGER NOT NULL,
  emoji_pack_count INTEGER DEFAULT 0,
  theme_count INTEGER DEFAULT 0,
  story_fragment BOOLEAN DEFAULT FALSE,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_rewards_user_id ON public.weekly_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rewards_week ON public.weekly_rewards(week_start DESC);

ALTER TABLE public.weekly_rewards ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.weekly_rewards IS '每周活跃奖励表';
COMMENT ON COLUMN public.weekly_rewards.activity_level IS '活跃度等级：basic(≥15点), active(≥30点), deep(≥50点)';