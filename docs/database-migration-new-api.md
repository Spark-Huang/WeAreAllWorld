# 数据库迁移说明

## 执行方式

在 Supabase 控制台的 SQL Editor 中执行以下 SQL：

```sql
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_new_api_user_id ON users(new_api_user_id);
CREATE INDEX IF NOT EXISTS idx_users_new_api_token ON users(new_api_token);
```

## 访问 Supabase SQL Editor

1. 打开 https://supabase.com/dashboard
2. 选择项目 `kmbmfzehpjjctvuagecd`
3. 点击左侧 "SQL Editor"
4. 粘贴上面的 SQL 并执行

## 验证迁移

执行后运行：
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE 'new_api%';
```

应该返回 4 行结果。