/**
 * 数据库迁移：添加 New API 相关字段
 * 
 * 执行方式：
 * 1. 在 Supabase SQL Editor 中执行
 * 2. 或使用 Supabase CLI: supabase db push
 */

-- 添加 New API 相关字段到 users 表
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_api_user_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_api_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_api_quota BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_api_created_at TIMESTAMP WITH TIME ZONE;

-- 添加注释
COMMENT ON COLUMN users.new_api_user_id IS 'New API 网关中的用户 ID';
COMMENT ON COLUMN users.new_api_token IS 'New API 网关生成的 API Token';
COMMENT ON COLUMN users.new_api_quota IS '用户当前额度（本地缓存）';
COMMENT ON COLUMN users.new_api_created_at IS 'New API 账户创建时间';

-- 创建索引（用于快速查询）
CREATE INDEX IF NOT EXISTS idx_users_new_api_user_id ON users(new_api_user_id);
CREATE INDEX IF NOT EXISTS idx_users_new_api_token ON users(new_api_token);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_new_api_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 如果不存在则创建触发器
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'users_new_api_update'
    ) THEN
        CREATE TRIGGER users_new_api_update
            BEFORE UPDATE OF new_api_user_id, new_api_token, new_api_quota
            ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_new_api_updated_at();
    END IF;
END $$;