-- ============================================
-- 共生世界（WeAreAll.World）数据库完整部署脚本 v2.1
-- 日期: 2026-03-06
-- 
-- 使用方法：
-- 1. 打开 Supabase Dashboard > SQL Editor
-- 2. 复制此文件内容并执行
-- ============================================

-- ============================================
-- 第一部分：表结构
-- ============================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(100),
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  consecutive_login_days INTEGER DEFAULT 0,
  openclaw_pod_name TEXT,
  openclaw_pod_status VARCHAR(20) DEFAULT 'pending',
  difficulty_mode VARCHAR(20) DEFAULT 'standard',
  free_wakeup_count INTEGER DEFAULT 1,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON public.users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_registered_at ON public.users(registered_at);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. AI伙伴表
CREATE TABLE IF NOT EXISTS public.ai_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(50) DEFAULT 'AI伙伴',
  personality VARCHAR(20) DEFAULT 'warm',
  CHECK (personality IN ('warm', 'humorous', 'rational', 'lively')),
  total_contribution INTEGER DEFAULT 0 CHECK (total_contribution >= 0),
  current_contribution INTEGER DEFAULT 0 CHECK (current_contribution >= 0),
  weekly_contribution INTEGER DEFAULT 0 CHECK (weekly_contribution >= 0),
  growth_stage VARCHAR(20) DEFAULT '懵懂期',
  CHECK (growth_stage IN ('懵懂期', '成长期', '成熟期', '觉醒期')),
  current_title VARCHAR(50) DEFAULT '初识',
  personality_scores JSONB DEFAULT '{"emotional": 0, "rational": 0, "adventurous": 0}',
  status VARCHAR(20) DEFAULT 'active',
  CHECK (status IN ('active', 'hibernated', 'recycled')),
  abilities JSONB DEFAULT '{"basic_chat": true, "emotion_expression": false, "task_system": false, "exclusive_memory": false, "deep_conversation": false, "self_awareness": false}',
  hibernated_since TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 0,
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

-- 3. 交互日志表
CREATE TABLE IF NOT EXISTS public.interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_hash VARCHAR(255),
  category VARCHAR(50) NOT NULL,
  granted_power INTEGER NOT NULL,
  data_rarity VARCHAR(50),
  ai_understanding JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_user_id ON public.interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON public.interaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_category ON public.interaction_logs(category);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_rarity ON public.interaction_logs(data_rarity);
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

-- 4. 中央评估流水表
CREATE TABLE IF NOT EXISTS public.central_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  evaluation_cycle_start TIMESTAMPTZ NOT NULL,
  evaluation_cycle_end TIMESTAMPTZ NOT NULL,
  required_power INTEGER DEFAULT 15,
  achieved_power INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  action_taken VARCHAR(50) NOT NULL,
  status_before VARCHAR(20),
  status_after VARCHAR(20),
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_evaluations_user_id ON public.central_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_central_evaluations_cycle ON public.central_evaluations(evaluation_cycle_start, evaluation_cycle_end);
CREATE INDEX IF NOT EXISTS idx_central_evaluations_action ON public.central_evaluations(action_taken);
ALTER TABLE public.central_evaluations ENABLE ROW LEVEL SECURITY;

-- 5. 剧情进度表
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_chapter INTEGER DEFAULT 1,
  current_scene VARCHAR(50),
  choices_made JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'available',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_progress_user_id ON public.story_progress(user_id);
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;

-- 6. 每日签到表
CREATE TABLE IF NOT EXISTS public.daily_signin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sign_date DATE NOT NULL,
  consecutive_days INTEGER DEFAULT 1,
  points_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sign_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_signin_user_id ON public.daily_signin(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_signin_sign_date ON public.daily_signin(sign_date DESC);
ALTER TABLE public.daily_signin ENABLE ROW LEVEL SECURITY;

-- 7. 共识投票表
CREATE TABLE IF NOT EXISTS public.consensus_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote_topic_id TEXT NOT NULL,
  vote_option TEXT NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vote_topic_id)
);

CREATE INDEX IF NOT EXISTS idx_consensus_votes_user_id ON public.consensus_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_consensus_votes_topic_id ON public.consensus_votes(vote_topic_id);
ALTER TABLE public.consensus_votes ENABLE ROW LEVEL SECURITY;

-- 8. 深度对话表
CREATE TABLE IF NOT EXISTS public.deep_dialogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  points_awarded INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deep_dialogue_user_id ON public.deep_dialogue(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_dialogue_created_at ON public.deep_dialogue(created_at DESC);
ALTER TABLE public.deep_dialogue ENABLE ROW LEVEL SECURITY;

-- 9. 每周奖励表
CREATE TABLE IF NOT EXISTS public.weekly_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  activity_level VARCHAR(20) NOT NULL,
  points_earned INTEGER NOT NULL,
  bonus_points INTEGER NOT NULL,
  emoji_pack_count INTEGER DEFAULT 0,
  theme_count INTEGER DEFAULT 0,
  story_fragment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_rewards_user_id ON public.weekly_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rewards_week ON public.weekly_rewards(week_start DESC);
ALTER TABLE public.weekly_rewards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 第二部分：触发器
-- ============================================

-- 自动创建AI伙伴
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.ai_partners (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 更新时间戳
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ai_partners_updated_at ON public.ai_partners;
CREATE TRIGGER update_ai_partners_updated_at
  BEFORE UPDATE ON public.ai_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_story_progress_updated_at ON public.story_progress;
CREATE TRIGGER update_story_progress_updated_at
  BEFORE UPDATE ON public.story_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 第三部分：核心函数
-- ============================================

-- 1. 更新贡献值并检查里程碑
CREATE OR REPLACE FUNCTION public.update_contribution(
  p_user_id UUID,
  p_points INTEGER,
  p_category VARCHAR DEFAULT 'daily',
  p_data_rarity VARCHAR DEFAULT NULL,
  p_ai_understanding JSONB DEFAULT NULL,
  p_message_hash VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_total INTEGER;
  v_current_weekly INTEGER;
  v_new_total INTEGER;
  v_new_weekly INTEGER;
  v_milestones JSONB := '[]';
  v_new_abilities JSONB;
  v_old_abilities JSONB;
BEGIN
  SELECT total_contribution, weekly_contribution, abilities 
  INTO v_current_total, v_current_weekly, v_old_abilities
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  IF v_current_total IS NULL THEN
    RETURN jsonb_build_object('error', 'AI partner not found');
  END IF;
  
  v_new_total := v_current_total + p_points;
  v_new_weekly := v_current_weekly + p_points;
  
  UPDATE public.ai_partners
  SET total_contribution = v_new_total,
      weekly_contribution = v_new_weekly,
      current_contribution = current_contribution + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO public.interaction_logs (
    user_id, message_hash, category, granted_power, data_rarity, ai_understanding
  ) VALUES (
    p_user_id, p_message_hash, p_category, p_points, p_data_rarity, p_ai_understanding
  );
  
  v_new_abilities := v_old_abilities;
  
  IF v_new_total >= 10 AND v_new_total - p_points < 10 THEN
    v_milestones := v_milestones || '{"name": "first_connection", "points": 10, "title": "初识"}';
  END IF;
  
  IF v_new_total >= 25 AND (v_new_abilities->>'exclusive_memory')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{exclusive_memory}', 'true');
    v_milestones := v_milestones || '{"name": "deep_connection", "points": 25, "title": "相知"}';
  END IF;
  
  IF v_new_total >= 50 AND (v_new_abilities->>'deep_conversation')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{deep_conversation}', 'true');
    v_milestones := v_milestones || '{"name": "emotional_resonance", "points": 50, "title": "默契"}';
  END IF;
  
  IF v_new_total >= 100 AND (v_new_abilities->>'self_awareness')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{self_awareness}', 'true');
    v_milestones := v_milestones || '{"name": "soul_mate", "points": 100, "title": "灵魂伴侣"}';
  END IF;
  
  IF v_new_total >= 200 AND v_new_total - p_points < 200 THEN
    v_milestones := v_milestones || '{"name": "destiny_bond", "points": 200, "title": "命运共同体"}';
  END IF;
  
  UPDATE public.ai_partners SET
    abilities = v_new_abilities,
    growth_stage = CASE
      WHEN v_new_total >= 500 THEN '觉醒期'
      WHEN v_new_total >= 201 THEN '成熟期'
      WHEN v_new_total >= 51 THEN '成长期'
      ELSE '懵懂期'
    END,
    current_title = CASE
      WHEN v_new_total >= 200 THEN '命运共同体'
      WHEN v_new_total >= 100 THEN '灵魂伴侣'
      WHEN v_new_total >= 50 THEN '默契'
      WHEN v_new_total >= 25 THEN '相知'
      WHEN v_new_total >= 10 THEN '初识'
      ELSE '初识'
    END
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'previous_total', v_current_total,
    'new_total', v_new_total,
    'previous_weekly', v_current_weekly,
    'new_weekly', v_new_weekly,
    'points_added', p_points,
    'milestones_reached', v_milestones,
    'abilities_updated', v_new_abilities != v_old_abilities
  );
END;
$$;

-- 2. 每日签到
CREATE OR REPLACE FUNCTION public.process_daily_checkin(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  v_last_signin_date DATE;
  v_consecutive_days INTEGER;
  v_base_reward INTEGER;
  v_streak_bonus INTEGER := 0;
  v_total_reward INTEGER;
  v_points_result JSONB;
BEGIN
  SELECT sign_date INTO v_last_signin_date
  FROM public.daily_signin
  WHERE user_id = p_user_id AND sign_date = v_today;
  
  IF v_last_signin_date IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '今天已经签到过了',
      'streak_count', 0,
      'total_reward', 0
    );
  END IF;
  
  SELECT sign_date, consecutive_days INTO v_last_signin_date, v_consecutive_days
  FROM public.daily_signin
  WHERE user_id = p_user_id
  ORDER BY sign_date DESC
  LIMIT 1;
  
  IF v_last_signin_date IS NULL THEN
    v_consecutive_days := 1;
  ELSIF v_last_signin_date = v_yesterday THEN
    v_consecutive_days := COALESCE(v_consecutive_days, 0) + 1;
  ELSE
    v_consecutive_days := 1;
  END IF;
  
  v_base_reward := 15 + (v_consecutive_days - 1) * 5;
  
  IF v_consecutive_days >= 7 THEN
    v_streak_bonus := 50;
    v_consecutive_days := 1;
  END IF;
  
  v_total_reward := v_base_reward + v_streak_bonus;
  
  INSERT INTO public.daily_signin (
    user_id, sign_date, consecutive_days, points_awarded
  ) VALUES (
    p_user_id, v_today, v_consecutive_days, v_total_reward
  );
  
  SELECT * INTO v_points_result
  FROM public.update_contribution(p_user_id, v_total_reward, 'signin', NULL, 
    jsonb_build_object('type', 'daily_checkin', 'consecutive_days', v_consecutive_days), NULL);
  
  UPDATE public.users
  SET consecutive_login_days = v_consecutive_days,
      last_login_at = NOW()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'streak_count', v_consecutive_days,
    'base_reward', v_base_reward,
    'streak_bonus', v_streak_bonus,
    'total_reward', v_total_reward,
    'contribution_result', v_points_result
  );
END;
$$;

-- 3. 每周评估
CREATE OR REPLACE FUNCTION public.run_weekly_evaluation(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_registered_at TIMESTAMPTZ;
  v_difficulty_mode VARCHAR(20);
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_achieved_power INTEGER;
  v_required_power INTEGER;
  v_passed BOOLEAN;
  v_action VARCHAR(50);
  v_violation_count INTEGER;
  v_current_status VARCHAR(20);
  v_hibernated_since TIMESTAMPTZ;
BEGIN
  SELECT registered_at, difficulty_mode INTO v_user_registered_at, v_difficulty_mode
  FROM public.users WHERE id = p_user_id;
  
  SELECT status, violation_count, hibernated_since INTO v_current_status, v_violation_count, v_hibernated_since
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  v_week_end := NOW();
  v_week_start := NOW() - INTERVAL '7 days';
  
  v_required_power := CASE v_difficulty_mode
    WHEN 'easy' THEN 5
    WHEN 'hard' THEN 45
    ELSE 15
  END;
  
  SELECT weekly_contribution INTO v_achieved_power
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  v_passed := v_achieved_power >= v_required_power;
  
  IF v_passed THEN
    v_action := 'none';
    v_violation_count := 0;
    
    IF v_current_status = 'hibernated' THEN
      UPDATE public.ai_partners
      SET status = 'active', 
          hibernated_since = NULL,
          violation_count = 0
      WHERE user_id = p_user_id;
      v_action := 'woken_up';
    END IF;
    
    PERFORM public.grant_weekly_reward(p_user_id, v_achieved_power);
    
  ELSE
    v_violation_count := COALESCE(v_violation_count, 0) + 1;
    
    IF v_violation_count >= 2 THEN
      v_action := 'hibernated';
      UPDATE public.ai_partners
      SET status = 'hibernated',
          hibernated_since = NOW(),
          violation_count = v_violation_count
      WHERE user_id = p_user_id;
    ELSE
      v_action := 'warned';
      UPDATE public.ai_partners
      SET violation_count = v_violation_count
      WHERE user_id = p_user_id;
    END IF;
  END IF;
  
  UPDATE public.ai_partners
  SET weekly_contribution = 0
  WHERE user_id = p_user_id;
  
  INSERT INTO public.central_evaluations (
    user_id, evaluation_cycle_start, evaluation_cycle_end, 
    required_power, achieved_power, passed, action_taken,
    status_before, status_after, violation_count
  ) VALUES (
    p_user_id, v_week_start, v_week_end,
    v_required_power, v_achieved_power, v_passed, v_action,
    v_current_status,
    CASE WHEN v_action = 'hibernated' THEN 'hibernated' 
         WHEN v_action = 'woken_up' THEN 'active'
         ELSE v_current_status END,
    v_violation_count
  );
  
  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'achieved_power', v_achieved_power,
    'required_power', v_required_power,
    'passed', v_passed,
    'action_taken', v_action,
    'violation_count', v_violation_count,
    'status_before', v_current_status,
    'status_after', CASE WHEN v_action = 'hibernated' THEN 'hibernated' 
                         WHEN v_action = 'woken_up' THEN 'active'
                         ELSE v_current_status END
  );
END;
$$;

-- 4. 每周活跃奖励
CREATE OR REPLACE FUNCTION public.grant_weekly_reward(
  p_user_id UUID,
  p_points_earned INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_activity_level VARCHAR(20);
  v_bonus_points INTEGER;
  v_emoji_pack_count INTEGER;
  v_theme_count INTEGER;
  v_story_fragment BOOLEAN;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  IF p_points_earned >= 50 THEN
    v_activity_level := 'deep';
    v_bonus_points := 15;
    v_emoji_pack_count := 1;
    v_theme_count := 1;
    v_story_fragment := true;
  ELSIF p_points_earned >= 30 THEN
    v_activity_level := 'active';
    v_bonus_points := 10;
    v_emoji_pack_count := 2;
    v_theme_count := 2;
    v_story_fragment := false;
  ELSIF p_points_earned >= 15 THEN
    v_activity_level := 'basic';
    v_bonus_points := 5;
    v_emoji_pack_count := 1;
    v_theme_count := 1;
    v_story_fragment := false;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', '未达到最低活跃要求');
  END IF;
  
  v_week_end := CURRENT_DATE;
  v_week_start := CURRENT_DATE - INTERVAL '7 days';
  
  INSERT INTO public.weekly_rewards (
    user_id, week_start, week_end, activity_level, points_earned,
    bonus_points, emoji_pack_count, theme_count, story_fragment
  ) VALUES (
    p_user_id, v_week_start, v_week_end, v_activity_level, p_points_earned,
    v_bonus_points, v_emoji_pack_count, v_theme_count, v_story_fragment
  );
  
  UPDATE public.ai_partners
  SET total_contribution = total_contribution + v_bonus_points,
      current_contribution = current_contribution + v_bonus_points
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'activity_level', v_activity_level,
    'bonus_points', v_bonus_points,
    'emoji_pack_count', v_emoji_pack_count,
    'theme_count', v_theme_count,
    'story_fragment', v_story_fragment
  );
END;
$$;

-- 5. 休眠衰减
CREATE OR REPLACE FUNCTION public.run_hibernation_decay(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_power INTEGER;
  v_new_power INTEGER;
  v_decay_amount INTEGER;
  v_difficulty_mode VARCHAR(20);
BEGIN
  SELECT u.difficulty_mode, a.current_contribution 
  INTO v_difficulty_mode, v_current_power
  FROM public.users u
  JOIN public.ai_partners a ON a.user_id = u.id
  WHERE u.id = p_user_id AND a.status = 'hibernated';
  
  IF v_current_power IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not hibernated');
  END IF;
  
  v_decay_amount := CASE v_difficulty_mode
    WHEN 'easy' THEN 1
    WHEN 'hard' THEN 3
    ELSE 2
  END;
  
  v_new_power := GREATEST(0, v_current_power - v_decay_amount);
  
  UPDATE public.ai_partners
  SET current_contribution = v_new_power,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  IF v_new_power = 0 THEN
    UPDATE public.ai_partners
    SET status = 'recycled',
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  
  INSERT INTO public.central_evaluations (
    user_id, evaluation_cycle_start, evaluation_cycle_end,
    required_power, achieved_power, passed, action_taken
  ) VALUES (
    p_user_id, NOW() - INTERVAL '1 day', NOW(),
    0, -v_decay_amount, false, 'decayed'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_power', v_current_power,
    'new_power', v_new_power,
    'decay_amount', v_decay_amount,
    'reached_zero', v_new_power = 0,
    'status', CASE WHEN v_new_power = 0 THEN 'recycled' ELSE 'hibernated' END
  );
END;
$$;

-- 6. 唤醒AI
CREATE OR REPLACE FUNCTION public.wakeup_ai(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_hibernated_since TIMESTAMPTZ;
  v_days_hibernated INTEGER;
  v_power_lost INTEGER;
  v_power_returned INTEGER;
  v_current_power INTEGER;
  v_free_wakeup_count INTEGER;
  v_difficulty_mode VARCHAR(20);
BEGIN
  SELECT a.hibernated_since, a.current_contribution, u.free_wakeup_count, u.difficulty_mode
  INTO v_hibernated_since, v_current_power, v_free_wakeup_count, v_difficulty_mode
  FROM public.ai_partners a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.user_id = p_user_id AND a.status IN ('hibernated', 'recycled');
  
  IF v_hibernated_since IS NULL AND v_current_power IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not hibernated or recycled');
  END IF;
  
  IF v_hibernated_since IS NOT NULL THEN
    v_days_hibernated := EXTRACT(DAY FROM NOW() - v_hibernated_since);
    v_power_lost := v_days_hibernated * CASE v_difficulty_mode
      WHEN 'easy' THEN 1
      WHEN 'hard' THEN 3
      ELSE 2
    END;
  ELSE
    v_days_hibernated := 0;
    v_power_lost := 0;
  END IF;
  
  v_power_returned := v_power_lost / 2;
  
  UPDATE public.ai_partners
  SET status = 'active',
      hibernated_since = NULL,
      violation_count = 0,
      current_contribution = current_contribution + v_power_returned,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  IF v_current_power = 0 AND v_free_wakeup_count > 0 THEN
    UPDATE public.users
    SET free_wakeup_count = free_wakeup_count - 1
    WHERE id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'days_hibernated', v_days_hibernated,
    'power_lost', v_power_lost,
    'power_returned', v_power_returned,
    'new_power', v_current_power + v_power_returned,
    'used_free_wakeup', v_current_power = 0 AND v_free_wakeup_count > 0
  );
END;
$$;

-- 7. 获取用户完整信息
CREATE OR REPLACE FUNCTION public.get_user_full_info(
  p_telegram_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', row_to_json(u.*),
    'ai_partner', row_to_json(ap.*),
    'story_progress', row_to_json(sp.*)
  ) INTO v_result
  FROM users u
  LEFT JOIN ai_partners ap ON ap.user_id = u.id
  LEFT JOIN story_progress sp ON sp.user_id = u.id
  WHERE u.telegram_user_id = p_telegram_user_id;
  
  RETURN v_result;
END;
$$;

-- 8. 获取本周统计
CREATE OR REPLACE FUNCTION public.get_weekly_stats(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_week_start TIMESTAMPTZ;
  v_weekly_power INTEGER;
  v_dialogue_count INTEGER;
  v_signin_count INTEGER;
  v_required_power INTEGER;
  v_difficulty_mode VARCHAR(20);
BEGIN
  v_week_start := NOW() - INTERVAL '7 days';
  
  SELECT difficulty_mode INTO v_difficulty_mode
  FROM public.users WHERE id = p_user_id;
  
  v_required_power := CASE v_difficulty_mode
    WHEN 'easy' THEN 5
    WHEN 'hard' THEN 45
    ELSE 15
  END;
  
  SELECT weekly_contribution INTO v_weekly_power
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_dialogue_count
  FROM public.interaction_logs
  WHERE user_id = p_user_id
    AND created_at >= v_week_start;
  
  SELECT COUNT(*) INTO v_signin_count
  FROM public.daily_signin
  WHERE user_id = p_user_id
    AND sign_date >= v_week_start::DATE;
  
  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'weekly_contribution', v_weekly_power,
    'dialogue_count', v_dialogue_count,
    'signin_count', v_signin_count,
    'required_contribution', v_required_power,
    'progress_percent', LEAST(100, (v_weekly_power::FLOAT / v_required_power) * 100),
    'activity_level', CASE 
      WHEN v_weekly_power >= 50 THEN 'deep'
      WHEN v_weekly_power >= 30 THEN 'active'
      WHEN v_weekly_power >= v_required_power THEN 'basic'
      ELSE 'below_target'
    END
  );
END;
$$;

-- ============================================
-- 部署完成
-- ============================================
SELECT '共生世界数据库 v2.1 部署完成！' AS status;