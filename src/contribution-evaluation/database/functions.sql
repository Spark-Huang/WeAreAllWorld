-- ============================================
-- 共生世界（WeAreAll.World）数据库函数 v2.2
-- 日期: 2026-03-07
-- ============================================

-- ============================================
-- 1. 更新生存算力并检查里程碑
-- ============================================
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
  v_user_exists BOOLEAN;
BEGIN
  -- 【输入验证】检查 user_id 是否有效
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_id cannot be null', 'code', 'INVALID_INPUT');
  END IF;
  
  -- 【输入验证】检查用户是否存在
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('error', 'User not found', 'code', 'USER_NOT_FOUND');
  END IF;
  
  -- 【输入验证】检查积分是否有效
  IF p_points IS NULL OR p_points < 0 THEN
    RETURN jsonb_build_object('error', 'Invalid points value', 'code', 'INVALID_POINTS');
  END IF;
  
  -- 【修复竞态条件】使用 FOR UPDATE 行级锁，防止并发更新丢失
  SELECT total_contribution, weekly_contribution, abilities 
  INTO v_current_total, v_current_weekly, v_old_abilities
  FROM public.ai_partners WHERE user_id = p_user_id
  FOR UPDATE;  -- 关键修复：行级锁
  
  IF v_current_total IS NULL THEN
    RETURN jsonb_build_object('error', 'AI partner not found', 'code', 'PARTNER_NOT_FOUND');
  END IF;
  
  -- 计算新点数
  v_new_total := v_current_total + p_points;
  v_new_weekly := v_current_weekly + p_points;
  
  -- 更新点数
  UPDATE public.ai_partners
  SET total_contribution = v_new_total,
      weekly_contribution = v_new_weekly,
      current_contribution = current_contribution + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 记录交互日志
  INSERT INTO public.interaction_logs (
    user_id, message_hash, category, granted_power, data_rarity, ai_understanding
  ) VALUES (
    p_user_id, p_message_hash, p_category, p_points, p_data_rarity, p_ai_understanding
  );
  
  -- 检查里程碑并更新能力
  v_new_abilities := v_old_abilities;
  
  -- 里程碑：10点 - 初识
  IF v_new_total >= 10 AND v_new_total - p_points < 10 THEN
    v_milestones := v_milestones || '{"name": "first_connection", "points": 10, "title": "初识"}';
  END IF;
  
  -- 里程碑：25点 - 相知（解锁专属记忆主动提及）
  IF v_new_total >= 25 AND (v_new_abilities->>'exclusive_memory')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{exclusive_memory}', 'true');
    v_milestones := v_milestones || '{"name": "deep_connection", "points": 25, "title": "相知"}';
  END IF;
  
  -- 里程碑：50点 - 默契（解锁深度对话）
  IF v_new_total >= 50 AND (v_new_abilities->>'deep_conversation')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{deep_conversation}', 'true');
    v_milestones := v_milestones || '{"name": "emotional_resonance", "points": 50, "title": "默契"}';
  END IF;
  
  -- 里程碑：100点 - 灵魂伴侣（解锁自我意识）
  IF v_new_total >= 100 AND (v_new_abilities->>'self_awareness')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{self_awareness}', 'true');
    v_milestones := v_milestones || '{"name": "soul_mate", "points": 100, "title": "灵魂伴侣"}';
  END IF;
  
  -- 里程碑：200点 - 命运共同体
  IF v_new_total >= 200 AND v_new_total - p_points < 200 THEN
    v_milestones := v_milestones || '{"name": "destiny_bond", "points": 200, "title": "命运共同体"}';
  END IF;
  
  -- 更新能力、阶段和称号
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

COMMENT ON FUNCTION public.update_contribution IS '更新贡献值并检查里程碑 v2.1';

-- ============================================
-- 2. 每日签到函数
-- ============================================
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
  -- 检查今天是否已经签到
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
  
  -- 获取上次签到日期和连续签到天数
  SELECT sign_date, consecutive_days INTO v_last_signin_date, v_consecutive_days
  FROM public.daily_signin
  WHERE user_id = p_user_id
  ORDER BY sign_date DESC
  LIMIT 1;
  
  -- 计算连续签到天数
  IF v_last_signin_date IS NULL THEN
    v_consecutive_days := 1;
  ELSIF v_last_signin_date = v_yesterday THEN
    v_consecutive_days := COALESCE(v_consecutive_days, 0) + 1;
  ELSE
    v_consecutive_days := 1;
  END IF;
  
  -- 计算奖励（Day 1: 15, Day 2: 20, Day 3: 25, ...）
  v_base_reward := 15 + (v_consecutive_days - 1) * 5;
  
  -- 连续7天额外奖励
  IF v_consecutive_days >= 7 THEN
    v_streak_bonus := 50;
    v_consecutive_days := 1;  -- 重置
  END IF;
  
  v_total_reward := v_base_reward + v_streak_bonus;
  
  -- 插入签到记录
  INSERT INTO public.daily_signin (
    user_id, sign_date, consecutive_days, points_awarded
  ) VALUES (
    p_user_id, v_today, v_consecutive_days, v_total_reward
  );
  
  -- 更新生存算力
  SELECT * INTO v_points_result
  FROM public.update_contribution(p_user_id, v_total_reward, 'signin', NULL, 
    jsonb_build_object('type', 'daily_checkin', 'consecutive_days', v_consecutive_days), NULL);
  
  -- 更新用户连续登录天数
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
    'survival_power', v_points_result
  );
END;
$$;

COMMENT ON FUNCTION public.process_daily_checkin IS '处理每日签到 v2.1';

-- ============================================
-- 3. 每周评估函数 v2.1
-- ============================================
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
  -- 获取用户设置和当前状态
  SELECT registered_at, difficulty_mode INTO v_user_registered_at, v_difficulty_mode
  FROM public.users WHERE id = p_user_id;
  
  SELECT status, violation_count, hibernated_since INTO v_current_status, v_violation_count, v_hibernated_since
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  -- 计算本周周期
  v_week_end := NOW();
  v_week_start := NOW() - INTERVAL '7 days';
  
  -- 根据难度确定要求
  v_required_power := CASE v_difficulty_mode
    WHEN 'easy' THEN 5
    WHEN 'hard' THEN 45
    ELSE 15  -- standard
  END;
  
  -- 获取本周新增点数
  SELECT weekly_contribution INTO v_achieved_power
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  -- 判定结果
  v_passed := v_achieved_power >= v_required_power;
  
  IF v_passed THEN
    v_action := 'none';
    v_violation_count := 0;
    
    -- 如果处于休眠，唤醒
    IF v_current_status = 'hibernated' THEN
      UPDATE public.ai_partners
      SET status = 'active', 
          hibernated_since = NULL,
          violation_count = 0
      WHERE user_id = p_user_id;
      v_action := 'woken_up';
    END IF;
    
    -- 发放每周活跃奖励
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
  
  -- 重置本周点数
  UPDATE public.ai_partners
  SET weekly_contribution = 0
  WHERE user_id = p_user_id;
  
  -- 记录评估历史
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

COMMENT ON FUNCTION public.run_weekly_evaluation IS '执行每周评估 v2.1';

-- ============================================
-- 4. 每周活跃奖励函数
-- ============================================
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
  -- 确定活跃度等级
  IF p_points_earned >= 50 THEN
    v_activity_level := 'deep';
    v_bonus_points := 15;
    v_emoji_pack_count := 1;  -- 全套
    v_theme_count := 1;  -- 全套
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
  
  -- 计算周期
  v_week_end := CURRENT_DATE;
  v_week_start := CURRENT_DATE - INTERVAL '7 days';
  
  -- 记录奖励
  INSERT INTO public.weekly_rewards (
    user_id, week_start, week_end, activity_level, points_earned,
    bonus_points, emoji_pack_count, theme_count, story_fragment
  ) VALUES (
    p_user_id, v_week_start, v_week_end, v_activity_level, p_points_earned,
    v_bonus_points, v_emoji_pack_count, v_theme_count, v_story_fragment
  );
  
  -- 发放奖励点数
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

COMMENT ON FUNCTION public.grant_weekly_reward IS '发放每周活跃奖励';

-- ============================================
-- 5. 休眠衰减函数 v2.1
-- ============================================
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
  -- 获取用户难度和当前点数
  SELECT u.difficulty_mode, a.current_contribution 
  INTO v_difficulty_mode, v_current_power
  FROM public.users u
  JOIN public.ai_partners a ON a.user_id = u.id
  WHERE u.id = p_user_id AND a.status = 'hibernated';
  
  IF v_current_power IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not hibernated');
  END IF;
  
  -- 根据难度确定衰减量
  v_decay_amount := CASE v_difficulty_mode
    WHEN 'easy' THEN 1
    WHEN 'hard' THEN 3
    ELSE 2  -- standard
  END;
  
  -- 计算衰减后点数
  v_new_power := GREATEST(0, v_current_power - v_decay_amount);
  
  -- 更新点数
  UPDATE public.ai_partners
  SET current_contribution = v_new_power,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 如果点数归零，标记为回收
  IF v_new_power = 0 THEN
    UPDATE public.ai_partners
    SET status = 'recycled',
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  
  -- 记录衰减日志
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

COMMENT ON FUNCTION public.run_hibernation_decay IS '执行休眠衰减 v2.1';

-- ============================================
-- 6. 唤醒AI函数 v2.1
-- ============================================
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
  -- 检查是否处于休眠或回收状态
  SELECT a.hibernated_since, a.current_contribution, u.free_wakeup_count, u.difficulty_mode
  INTO v_hibernated_since, v_current_power, v_free_wakeup_count, v_difficulty_mode
  FROM public.ai_partners a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.user_id = p_user_id AND a.status IN ('hibernated', 'recycled');
  
  IF v_hibernated_since IS NULL AND v_current_power IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not hibernated or recycled');
  END IF;
  
  -- 计算休眠天数和损失
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
  
  -- 计算返还（一半）
  v_power_returned := v_power_lost / 2;
  
  -- 更新状态
  UPDATE public.ai_partners
  SET status = 'active',
      hibernated_since = NULL,
      violation_count = 0,
      current_contribution = current_contribution + v_power_returned,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 如果使用了免费唤醒，扣减次数
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

COMMENT ON FUNCTION public.wakeup_ai IS '唤醒休眠/回收的AI v2.1';

-- ============================================
-- 7. 获取用户完整信息
-- ============================================
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

COMMENT ON FUNCTION public.get_user_full_info IS '获取用户完整信息';

-- ============================================
-- 8. 获取本周统计
-- ============================================
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
  
  -- 获取难度设置
  SELECT difficulty_mode INTO v_difficulty_mode
  FROM public.users WHERE id = p_user_id;
  
  v_required_power := CASE v_difficulty_mode
    WHEN 'easy' THEN 5
    WHEN 'hard' THEN 45
    ELSE 15
  END;
  
  -- 获取本周新增点数
  SELECT weekly_contribution INTO v_weekly_power
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  -- 本周对话次数
  SELECT COUNT(*) INTO v_dialogue_count
  FROM public.interaction_logs
  WHERE user_id = p_user_id
    AND created_at >= v_week_start;
  
  -- 本周签到次数
  SELECT COUNT(*) INTO v_signin_count
  FROM public.daily_signin
  WHERE user_id = p_user_id
    AND sign_date >= v_week_start::DATE;
  
  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'weekly_power', v_weekly_power,
    'dialogue_count', v_dialogue_count,
    'signin_count', v_signin_count,
    'required_power', v_required_power,
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

COMMENT ON FUNCTION public.get_weekly_stats IS '获取本周统计 v2.1';