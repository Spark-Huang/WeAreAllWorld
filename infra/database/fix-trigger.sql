-- =====================================================
-- 修复触发器：quality_score → granted_power
-- 在 Supabase SQL Editor 中执行
-- =====================================================

-- 1. 删除旧触发器
DROP TRIGGER IF EXISTS trigger_analyze_contribution ON interaction_logs;

-- 2. 删除旧函数
DROP FUNCTION IF EXISTS analyze_contribution_after_dialogue();

-- 3. 创建修复后的函数
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

-- 4. 创建新触发器
CREATE TRIGGER trigger_analyze_contribution
AFTER INSERT ON interaction_logs
FOR EACH ROW
EXECUTE FUNCTION analyze_contribution_after_dialogue();

-- 5. 验证触发器已创建
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_analyze_contribution';