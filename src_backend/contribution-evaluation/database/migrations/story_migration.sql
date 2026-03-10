-- ============================================
-- 剧情系统数据库迁移脚本
-- 日期: 2026-03-07
-- ============================================

-- 添加 completed_chapters 字段
ALTER TABLE public.story_progress 
ADD COLUMN IF NOT EXISTS completed_chapters JSONB DEFAULT '[]';

-- 添加 total_rewards 字段
ALTER TABLE public.story_progress 
ADD COLUMN IF NOT EXISTS total_rewards INTEGER DEFAULT 0;

-- 更新 current_scene 默认值
ALTER TABLE public.story_progress 
ALTER COLUMN current_scene SET DEFAULT 'ch1_scene1';

-- 添加状态约束
ALTER TABLE public.story_progress 
DROP CONSTRAINT IF EXISTS story_progress_status_check;

ALTER TABLE public.story_progress 
ADD CONSTRAINT story_progress_status_check 
CHECK (status IN ('available', 'locked', 'completed'));

-- 更新注释
COMMENT ON COLUMN public.story_progress.completed_chapters IS '已完成的章节ID列表';
COMMENT ON COLUMN public.story_progress.total_rewards IS '剧情累计获得的贡献值奖励';

-- 为现有记录设置默认值
UPDATE public.story_progress 
SET completed_chapters = '[]' 
WHERE completed_chapters IS NULL;

UPDATE public.story_progress 
SET total_rewards = 0 
WHERE total_rewards IS NULL;