-- ============================================
-- 共生世界（WeAreAll.World）数据库触发器
-- 版本: MVP v1.0
-- 日期: 2026-03-06
-- ============================================

-- ============================================
-- 1. 用户创建时自动初始化AI伙伴和剧情进度
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 创建AI伙伴
  INSERT INTO public.ai_partners (user_id, personality, name)
  VALUES (NEW.id, 'warm', 'AI伙伴');
  
  -- 创建剧情进度
  INSERT INTO public.story_progress (user_id, current_chapter, status)
  VALUES (NEW.id, 1, 'available');
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_new_user ON public.users;
CREATE TRIGGER on_new_user
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '用户创建时自动创建AI伙伴和剧情进度';

-- ============================================
-- 2. 自动更新updated_at字段
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 应用到相关表
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

COMMENT ON FUNCTION public.update_updated_at IS '自动更新updated_at字段';

-- ============================================
-- 3. 记忆点数变化时更新最后互动时间
-- ============================================
CREATE OR REPLACE FUNCTION public.update_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只有正向点数变化才更新
  IF NEW.points > 0 THEN
    UPDATE public.ai_partners
    SET last_interaction_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_memory_points_change ON public.memory_points_log;
CREATE TRIGGER on_memory_points_change
  AFTER INSERT ON public.memory_points_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_interaction();

COMMENT ON FUNCTION public.update_last_interaction IS '记忆点数变化时更新最后互动时间';

-- ============================================
-- 4. AI状态变化时记录日志
-- ============================================
CREATE OR REPLACE FUNCTION public.log_ai_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只有状态变化时才记录
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.memory_points_log (user_id, points, source_type, source_detail)
    VALUES (
      NEW.user_id, 
      0, 
      'status_change',
      format('AI状态从%s变为%s', OLD.status, NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ai_status_change ON public.ai_partners;
CREATE TRIGGER on_ai_status_change
  AFTER UPDATE ON public.ai_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ai_status_change();

COMMENT ON FUNCTION public.log_ai_status_change IS 'AI状态变化时记录日志';