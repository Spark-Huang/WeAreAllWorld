-- 异步质量判定迁移
-- 1. 修改 interaction_logs 表，添加原始消息字段
-- 2. 创建异步评估队列表

-- 1. 为 interaction_logs 添加原始消息字段
ALTER TABLE interaction_logs 
ADD COLUMN IF NOT EXISTS raw_message TEXT,
ADD COLUMN IF NOT EXISTS raw_reply TEXT,
ADD COLUMN IF NOT EXISTS quick_quality_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS quick_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS llm_evaluated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS llm_quality_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS llm_points INTEGER,
ADD COLUMN IF NOT EXISTS llm_evaluated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);

-- 2. 创建对话会话表（用于批量评估）
CREATE TABLE IF NOT EXISTS dialogue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  total_quick_points INTEGER DEFAULT 0,
  total_llm_points INTEGER DEFAULT 0,
  llm_evaluated BOOLEAN DEFAULT FALSE,
  llm_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建异步评估队列表
CREATE TABLE IF NOT EXISTS async_evaluation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES dialogue_sessions(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_interaction_logs_session ON interaction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_llm_evaluated ON interaction_logs(llm_evaluated);
CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_user ON dialogue_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_sessions_evaluated ON dialogue_sessions(llm_evaluated);
CREATE INDEX IF NOT EXISTS idx_async_queue_status ON async_evaluation_queue(status);
CREATE INDEX IF NOT EXISTS idx_async_queue_scheduled ON async_evaluation_queue(scheduled_at);

-- 5. 创建更新对话会话的函数
CREATE OR REPLACE FUNCTION end_dialogue_session(
  p_session_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE dialogue_sessions 
  SET 
    ended_at = NOW(),
    message_count = (
      SELECT COUNT(*) FROM interaction_logs WHERE session_id = p_session_id
    ),
    total_quick_points = (
      SELECT COALESCE(SUM(quick_points), 0) FROM interaction_logs WHERE session_id = p_session_id
    )
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建异步评估函数
CREATE OR REPLACE FUNCTION create_async_evaluation(
  p_user_id UUID,
  p_session_id UUID
) RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO async_evaluation_queue (user_id, session_id)
  VALUES (p_user_id, p_session_id)
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建获取待评估会话的函数
CREATE OR REPLACE FUNCTION get_pending_evaluations(
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  queue_id UUID,
  user_id UUID,
  session_id UUID,
  message_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as queue_id,
    q.user_id,
    q.session_id,
    s.message_count
  FROM async_evaluation_queue q
  JOIN dialogue_sessions s ON q.session_id = s.id
  WHERE q.status = 'pending'
    AND q.scheduled_at <= NOW()
  ORDER BY q.scheduled_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建完成评估的函数
CREATE OR REPLACE FUNCTION complete_evaluation(
  p_queue_id UUID,
  p_total_llm_points INTEGER
) RETURNS VOID AS $$
BEGIN
  -- 更新队列状态
  UPDATE async_evaluation_queue 
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_queue_id;
  
  -- 更新会话状态
  UPDATE dialogue_sessions 
  SET 
    llm_evaluated = TRUE,
    llm_evaluated_at = NOW(),
    total_llm_points = p_total_llm_points
  WHERE id = (
    SELECT session_id FROM async_evaluation_queue WHERE id = p_queue_id
  );
END;
$$ LANGUAGE plpgsql;

-- 9. 注释
COMMENT ON TABLE dialogue_sessions IS '对话会话表，用于批量 LLM 评估';
COMMENT ON TABLE async_evaluation_queue IS '异步评估队列，定时任务处理';
COMMENT ON COLUMN interaction_logs.raw_message IS '用户原始消息';
COMMENT ON COLUMN interaction_logs.raw_reply IS 'AI 原始回复';
COMMENT ON COLUMN interaction_logs.quick_quality_type IS '快速判定的质量类型（关键词匹配）';
COMMENT ON COLUMN interaction_logs.quick_points IS '快速判定的点数';
COMMENT ON COLUMN interaction_logs.llm_evaluated IS '是否已进行 LLM 评估';
COMMENT ON COLUMN interaction_logs.llm_quality_type IS 'LLM 评估的质量类型';
COMMENT ON COLUMN interaction_logs.llm_points IS 'LLM 评估的点数';