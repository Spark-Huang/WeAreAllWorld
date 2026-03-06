-- ============================================
-- 共生世界（WeAreAll.World）数据库触发器 v2.1
-- 日期: 2026-03-06
-- ============================================

-- ============================================
-- 1. 自动创建AI伙伴记录
-- ============================================
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

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS on_user_created ON public.users;

-- 创建触发器
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS '新用户注册时自动创建AI伙伴记录';

-- ============================================
-- 2. 更新时间戳触发器
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

-- 用户表更新时间戳
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- AI伙伴表更新时间戳
DROP TRIGGER IF EXISTS update_ai_partners_updated_at ON public.ai_partners;
CREATE TRIGGER update_ai_partners_updated_at
  BEFORE UPDATE ON public.ai_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 剧情进度表更新时间戳
DROP TRIGGER IF EXISTS update_story_progress_updated_at ON public.story_progress;
CREATE TRIGGER update_story_progress_updated_at
  BEFORE UPDATE ON public.story_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON FUNCTION public.update_updated_at IS '自动更新updated_at字段';

-- ============================================
-- 3. 贡献值变化事件触发器（用于里程碑通知）
-- ============================================
CREATE OR REPLACE FUNCTION public.on_contribution_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 当累计贡献值变化时，可以在这里添加通知逻辑
  -- 例如：插入通知队列、触发Webhook等
  RETURN NEW;
END;
$$;

-- 贡献值变化触发器
DROP TRIGGER IF EXISTS contribution_changed ON public.ai_partners;
CREATE TRIGGER contribution_changed
  AFTER UPDATE OF total_contribution ON public.ai_partners
  FOR EACH ROW
  WHEN (OLD.total_contribution IS DISTINCT FROM NEW.total_contribution)
  EXECUTE FUNCTION public.on_contribution_changed();

COMMENT ON FUNCTION public.on_contribution_changed IS '贡献值变化事件处理';