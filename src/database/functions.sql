-- ============================================
-- 共生世界（WeAreAll.World）数据库函数
-- 版本: MVP v1.0
-- 日期: 2026-03-06
-- ============================================

-- ============================================
-- 1. 更新记忆点数并检查里程碑
-- ============================================
CREATE OR REPLACE FUNCTION public.update_memory_points(
  p_user_id UUID,
  p_points INTEGER,
  p_source_type VARCHAR DEFAULT 'dialogue',
  p_source_detail TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_milestones JSONB := '[]';
  v_new_abilities JSONB;
  v_old_abilities JSONB;
BEGIN
  -- 获取当前点数和能力
  SELECT memory_points, abilities INTO v_current_points, v_old_abilities
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  IF v_current_points IS NULL THEN
    RETURN jsonb_build_object('error', 'AI partner not found');
  END IF;
  
  -- 计算新点数（不允许负数）
  v_new_points := GREATEST(0, v_current_points + p_points);
  
  -- 更新点数
  UPDATE public.ai_partners
  SET memory_points = v_new_points,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 记录日志
  INSERT INTO public.memory_points_log (user_id, points, source_type, source_detail)
  VALUES (p_user_id, p_points, p_source_type, p_source_detail);
  
  -- 检查里程碑并更新能力
  v_new_abilities := v_old_abilities;
  
  IF v_new_points >= 5 AND (v_new_abilities->>'emotion_expression')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{emotion_expression}', 'true');
    v_milestones := v_milestones || '{"name": "emotion_expression", "points": 5, "title": "情感表达"}';
  END IF;
  
  IF v_new_points >= 15 AND (v_new_abilities->>'task_system')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{task_system}', 'true');
    v_milestones := v_milestones || '{"name": "task_system", "points": 15, "title": "任务系统"}';
  END IF;
  
  IF v_new_points >= 25 AND (v_new_abilities->>'exclusive_memory')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{exclusive_memory}', 'true');
    v_milestones := v_milestones || '{"name": "exclusive_memory", "points": 25, "title": "专属记忆"}';
  END IF;
  
  IF v_new_points >= 50 AND (v_new_abilities->>'deep_conversation')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{deep_conversation}', 'true');
    v_milestones := v_milestones || '{"name": "deep_conversation", "points": 50, "title": "深度对话"}';
  END IF;
  
  IF v_new_points >= 100 AND (v_new_abilities->>'self_awareness')::boolean = false THEN
    v_new_abilities := jsonb_set(v_new_abilities, '{self_awareness}', 'true');
    v_milestones := v_milestones || '{"name": "self_awareness", "points": 100, "title": "自我意识"}';
  END IF;
  
  -- 更新能力、阶段和称号
  UPDATE public.ai_partners SET
    abilities = v_new_abilities,
    growth_stage = CASE
      WHEN v_new_points >= 500 THEN '觉醒期'
      WHEN v_new_points >= 201 THEN '成熟期'
      WHEN v_new_points >= 51 THEN '成长期'
      ELSE '懵懂期'
    END,
    current_title = CASE
      WHEN v_new_points >= 200 THEN '命运共同体'
      WHEN v_new_points >= 100 THEN '灵魂伴侣'
      WHEN v_new_points >= 50 THEN '默契'
      WHEN v_new_points >= 25 THEN '相知'
      WHEN v_new_points >= 10 THEN '初识'
      ELSE '初识'
    END
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'previous_points', v_current_points,
    'new_points', v_new_points,
    'points_added', p_points,
    'milestones_reached', v_milestones,
    'abilities_updated', v_new_abilities != v_old_abilities
  );
END;
$$;

COMMENT ON FUNCTION public.update_memory_points IS '更新记忆点数并检查里程碑';

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
  v_base_reward INTEGER := 15;
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
  
  -- 计算奖励（连续签到递增）
  v_base_reward := 15 + (v_consecutive_days - 1) * 5;  -- Day 1: 15, Day 2: 20, ...
  
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
  
  -- 更新记忆点数
  SELECT * INTO v_points_result
  FROM public.update_memory_points(p_user_id, v_total_reward, 'signin', 
    format('每日签到，连续%s天', v_consecutive_days));
  
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
    'memory_points', v_points_result
  );
END;
$$;

COMMENT ON FUNCTION public.process_daily_checkin IS '处理每日签到';

-- ============================================
-- 3. 每周评估函数
-- ============================================
CREATE OR REPLACE FUNCTION public.run_weekly_evaluation(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_registered_at TIMESTAMPTZ;
  v_week_start DATE;
  v_week_end DATE;
  v_points_grown INTEGER;
  v_result VARCHAR(20);
  v_consecutive_warnings INTEGER;
  v_current_status VARCHAR(20);
  v_dormant_since TIMESTAMPTZ;
  v_threshold INTEGER := 15;
BEGIN
  -- 获取用户注册时间和当前状态
  SELECT registered_at INTO v_user_registered_at
  FROM public.users WHERE id = p_user_id;
  
  SELECT status, consecutive_warnings, dormant_since INTO v_current_status, v_consecutive_warnings, v_dormant_since
  FROM public.ai_partners WHERE user_id = p_user_id;
  
  -- 计算本周开始日期（基于用户注册日期）
  v_week_end := CURRENT_DATE;
  v_week_start := CURRENT_DATE - INTERVAL '7 days';
  
  -- 获取本周新增点数
  SELECT COALESCE(SUM(points), 0) INTO v_points_grown
  FROM public.memory_points_log
  WHERE user_id = p_user_id
    AND created_at >= v_week_start
    AND points > 0;
  
  -- 判定结果
  IF v_points_grown >= v_threshold THEN
    v_result := 'pass';
    -- 重置警告计数
    v_consecutive_warnings := 0;
    
    -- 如果处于休眠，唤醒
    IF v_current_status = 'dormant' THEN
      UPDATE public.ai_partners
      SET status = 'normal', 
          dormant_since = NULL,
          consecutive_warnings = 0
      WHERE user_id = p_user_id;
    END IF;
  ELSE
    v_result := 'warning';
    v_consecutive_warnings := COALESCE(v_consecutive_warnings, 0) + 1;
    
    -- 连续两周不通过，进入休眠
    IF v_consecutive_warnings >= 2 THEN
      v_result := 'dormant';
      UPDATE public.ai_partners
      SET status = 'dormant',
          dormant_since = NOW(),
          consecutive_warnings = v_consecutive_warnings
      WHERE user_id = p_user_id;
    ELSE
      -- 第一次警告
      UPDATE public.ai_partners
      SET consecutive_warnings = v_consecutive_warnings
      WHERE user_id = p_user_id;
    END IF;
  END IF;
  
  -- 记录评估历史
  INSERT INTO public.weekly_evaluations (
    user_id, week_start, week_end, points_grown, threshold, result,
    status_before, status_after, consecutive_warnings
  ) VALUES (
    p_user_id, v_week_start, v_week_end, v_points_grown, v_threshold, v_result,
    v_current_status,
    CASE WHEN v_result = 'dormant' THEN 'dormant' 
         WHEN v_result = 'pass' AND v_current_status = 'dormant' THEN 'normal'
         ELSE v_current_status END,
    v_consecutive_warnings
  );
  
  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'points_grown', v_points_grown,
    'threshold', v_threshold,
    'result', v_result,
    'consecutive_warnings', v_consecutive_warnings,
    'status_before', v_current_status,
    'status_after', CASE WHEN v_result = 'dormant' THEN 'dormant' 
                         WHEN v_result = 'pass' AND v_current_status = 'dormant' THEN 'normal'
                         ELSE v_current_status END
  );
END;
$$;

COMMENT ON FUNCTION public.run_weekly_evaluation IS '执行每周评估';

-- ============================================
-- 4. 休眠衰减函数
-- ============================================
CREATE OR REPLACE FUNCTION public.run_dormant_decay(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_decay_amount INTEGER := 2;
BEGIN
  -- 获取当前点数
  SELECT memory_points INTO v_current_points
  FROM public.ai_partners 
  WHERE user_id = p_user_id AND status = 'dormant';
  
  IF v_current_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not dormant');
  END IF;
  
  -- 计算衰减后点数
  v_new_points := GREATEST(0, v_current_points - v_decay_amount);
  
  -- 更新点数
  UPDATE public.ai_partners
  SET memory_points = v_new_points,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 记录日志
  INSERT INTO public.memory_points_log (user_id, points, source_type, source_detail)
  VALUES (p_user_id, -v_decay_amount, 'dormant_decay', 
    format('休眠衰减，剩余%s点', v_new_points));
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_points', v_current_points,
    'new_points', v_new_points,
    'decay_amount', v_decay_amount,
    'reached_zero', v_new_points = 0
  );
END;
$$;

COMMENT ON FUNCTION public.run_dormant_decay IS '执行休眠衰减';

-- ============================================
-- 5. 唤醒AI函数
-- ============================================
CREATE OR REPLACE FUNCTION public.wakeup_ai(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dormant_since TIMESTAMPTZ;
  v_days_dormant INTEGER;
  v_points_lost INTEGER;
  v_points_returned INTEGER;
  v_current_points INTEGER;
BEGIN
  -- 检查是否处于休眠
  SELECT dormant_since, memory_points INTO v_dormant_since, v_current_points
  FROM public.ai_partners 
  WHERE user_id = p_user_id;
  
  IF v_dormant_since IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'AI not dormant');
  END IF;
  
  -- 计算休眠天数
  v_days_dormant := EXTRACT(DAY FROM NOW() - v_dormant_since);
  
  -- 计算损失和返还（返还一半）
  v_points_lost := v_days_dormant * 2;
  v_points_returned := v_points_lost / 2;
  
  -- 更新状态
  UPDATE public.ai_partners
  SET status = 'normal',
      dormant_since = NULL,
      consecutive_warnings = 0,
      memory_points = memory_points + v_points_returned,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 记录日志
  INSERT INTO public.memory_points_log (user_id, points, source_type, source_detail)
  VALUES (p_user_id, v_points_returned, 'wakeup', 
    format('唤醒AI，返还%s点', v_points_returned));
  
  RETURN jsonb_build_object(
    'success', true,
    'days_dormant', v_days_dormant,
    'points_lost', v_points_lost,
    'points_returned', v_points_returned,
    'new_points', v_current_points + v_points_returned
  );
END;
$$;

COMMENT ON FUNCTION public.wakeup_ai IS '唤醒休眠的AI';

-- ============================================
-- 6. 获取用户完整信息
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
-- 7. 获取本周统计
-- ============================================
CREATE OR REPLACE FUNCTION public.get_weekly_stats(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_week_start DATE;
  v_points_grown INTEGER;
  v_dialogue_count INTEGER;
  v_signin_count INTEGER;
BEGIN
  v_week_start := CURRENT_DATE - INTERVAL '7 days';
  
  -- 本周新增点数
  SELECT COALESCE(SUM(points), 0) INTO v_points_grown
  FROM memory_points_log
  WHERE user_id = p_user_id
    AND created_at >= v_week_start
    AND points > 0;
  
  -- 本周对话次数
  SELECT COUNT(*) INTO v_dialogue_count
  FROM memory_points_log
  WHERE user_id = p_user_id
    AND created_at >= v_week_start
    AND source_type = 'dialogue';
  
  -- 本周签到次数
  SELECT COUNT(*) INTO v_signin_count
  FROM daily_signin
  WHERE user_id = p_user_id
    AND sign_date >= v_week_start;
  
  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'points_grown', v_points_grown,
    'dialogue_count', v_dialogue_count,
    'signin_count', v_signin_count,
    'threshold', 15,
    'progress_percent', LEAST(100, (v_points_grown::FLOAT / 15) * 100)
  );
END;
$$;

COMMENT ON FUNCTION public.get_weekly_stats IS '获取本周统计';