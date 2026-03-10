-- 分享记录表
CREATE TABLE IF NOT EXISTS share_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('achievement', 'milestone', 'ai_status', 'story', 'daily')),
    share_platform VARCHAR(20) NOT NULL CHECK (share_platform IN ('twitter', 'wechat', 'weibo', 'other')),
    share_content JSONB NOT NULL,
    contribution_reward INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_share_records_user_id ON share_records(user_id);
CREATE INDEX IF NOT EXISTS idx_share_records_created_at ON share_records(created_at);
CREATE INDEX IF NOT EXISTS idx_share_records_user_created ON share_records(user_id, created_at);

-- RLS 策略
ALTER TABLE share_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的分享记录" ON share_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "服务端可以插入分享记录" ON share_records
    FOR INSERT WITH CHECK (true);

-- 注释
COMMENT ON TABLE share_records IS '社交分享记录表';
COMMENT ON COLUMN share_records.share_type IS '分享类型: achievement成就, milestone里程碑, ai_status状态, story剧情, daily日常';
COMMENT ON COLUMN share_records.share_platform IS '分享平台: twitter, wechat, weibo, other';
COMMENT ON COLUMN share_records.share_content IS '分享内容JSON';
COMMENT ON COLUMN share_records.contribution_reward IS '获得的贡献值奖励';
