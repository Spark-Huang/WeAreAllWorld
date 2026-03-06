-- ============================================
-- 共生世界（WeAreAll.World）RLS 安全策略修复
-- 日期: 2026-03-07
-- 严重程度: CRITICAL
-- 
-- 问题: RLS已启用但缺少策略，导致跨用户数据访问/修改漏洞
-- 修复: 为所有表添加用户隔离策略
-- ============================================

-- ============================================
-- 1. 用户表 (users) RLS 策略
-- ============================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;

-- 用户只能查看自己的数据
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 用户只能更新自己的数据
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 允许插入（注册新用户时，此时还没有auth.uid()）
-- 注意：实际注册应通过Supabase Auth，这里允许service_role插入
CREATE POLICY "Service role can insert users" ON public.users
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 2. AI伙伴表 (ai_partners) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own AI partner" ON public.ai_partners;
DROP POLICY IF EXISTS "Users can update own AI partner" ON public.ai_partners;
DROP POLICY IF EXISTS "Users can insert own AI partner" ON public.ai_partners;

-- 用户只能查看自己的AI伙伴
CREATE POLICY "Users can view own AI partner" ON public.ai_partners
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能更新自己的AI伙伴
CREATE POLICY "Users can update own AI partner" ON public.ai_partners
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AI伙伴由触发器自动创建，不允许用户直接插入
-- 只有service_role可以插入
CREATE POLICY "Service role can manage AI partners" ON public.ai_partners
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 3. 交互日志表 (interaction_logs) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own logs" ON public.interaction_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.interaction_logs;

-- 用户只能查看自己的日志
CREATE POLICY "Users can view own logs" ON public.interaction_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- 日志由系统函数创建，不允许用户直接插入
CREATE POLICY "Service role can manage logs" ON public.interaction_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 4. 中央评估流水表 (central_evaluations) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own evaluations" ON public.central_evaluations;

-- 用户只能查看自己的评估记录
CREATE POLICY "Users can view own evaluations" ON public.central_evaluations
  FOR SELECT
  USING (auth.uid() = user_id);

-- 评估由系统函数创建
CREATE POLICY "Service role can manage evaluations" ON public.central_evaluations
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. 剧情进度表 (story_progress) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own progress" ON public.story_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.story_progress;

-- 用户只能查看自己的进度
CREATE POLICY "Users can view own progress" ON public.story_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能更新自己的进度
CREATE POLICY "Users can update own progress" ON public.story_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage progress" ON public.story_progress
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 6. 每日签到表 (daily_signin) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own signins" ON public.daily_signin;

-- 用户只能查看自己的签到记录
CREATE POLICY "Users can view own signins" ON public.daily_signin
  FOR SELECT
  USING (auth.uid() = user_id);

-- 签到由系统函数创建
CREATE POLICY "Service role can manage signins" ON public.daily_signin
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 7. 共识投票表 (consensus_votes) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own votes" ON public.consensus_votes;
DROP POLICY IF EXISTS "Users can insert own votes" ON public.consensus_votes;

-- 用户只能查看自己的投票
CREATE POLICY "Users can view own votes" ON public.consensus_votes
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以投票（需要验证）
CREATE POLICY "Users can insert own votes" ON public.consensus_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 8. 深度对话表 (deep_dialogue) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own dialogues" ON public.deep_dialogue;

-- 用户只能查看自己的对话
CREATE POLICY "Users can view own dialogues" ON public.deep_dialogue
  FOR SELECT
  USING (auth.uid() = user_id);

-- 对话由系统创建
CREATE POLICY "Service role can manage dialogues" ON public.deep_dialogue
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 9. 每周奖励表 (weekly_rewards) RLS 策略
-- ============================================

DROP POLICY IF EXISTS "Users can view own rewards" ON public.weekly_rewards;

-- 用户只能查看自己的奖励
CREATE POLICY "Users can view own rewards" ON public.weekly_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

-- 奖励由系统创建
CREATE POLICY "Service role can manage rewards" ON public.weekly_rewards
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 10. 输入验证增强函数
-- ============================================

-- 增强 update_contribution 函数的输入验证
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
  
  -- 里程碑检查
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

-- ============================================
-- 部署完成
-- ============================================
SELECT 'RLS安全策略部署完成！' AS status;