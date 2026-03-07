-- 当 Supabase Auth 创建用户时，自动在 public.users 表中创建记录
-- 这个触发器需要在 Supabase SQL Editor 中执行

-- 1. 创建函数：处理新用户注册
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 在 public.users 表中插入新记录
  INSERT INTO public.users (id, telegram_username, onboarding_step, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'telegram_username', split_part(NEW.email, '@', 1)),
    0,
    false
  );
  
  -- AI 伙伴会通过 public.users 的触发器自动创建
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. 创建新触发器：在 auth.users 插入后执行
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. 注释
COMMENT ON FUNCTION public.handle_new_user() IS '处理新用户注册，自动在 public.users 表中创建记录';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS '当 Supabase Auth 创建用户时触发';