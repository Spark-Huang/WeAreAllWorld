# 共生世界（WeAreAll.World） MVP开发实现文档 - 数据库设计

**文档类型**：MVP开发实现文档（分册二）
**版本**：v18.0（基于最新共生规则系统开发架构文档重构）
**日期**：2026年3月6日

---

## 目录

1. [设计原则](#1-设计原则)
2. [核心表结构（主项目管控）](#2-核心表结构主项目管控)
3. [数据库函数与触发器](#3-数据库函数与触发器)

---

## 1. 设计原则

### 1.1 主子项目数据隔离
本系统的核心特性在于将**业务与状态资产**同**AI交互的具体记忆**进行强隔离：
- **Supabase (PostgreSQL)**：主项目专属，仅存储账号映射、算力账本、提纯后的数据资产(`interaction_logs`)以及生命周期审计(`central_evaluations`)。
- **PVC (云服务EVS)**：子项目专属，挂载在每个用户的OpenClaw Pod中，负责存储庞大且非结构化的长期Markdown记忆与JSONL对话历史。

### 1.2 高价值资产沉淀
`interaction_logs` 是本项目的核心资产库，大模型训练的绝佳私域数据集。不仅记录算力加减，还保留由评估LLM抽取的脱敏精华摘要和稀缺度定级。

---

## 2. 核心表结构（主项目管控）

### 2.1 users (用户基础表)

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(100),
  
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON public.users(telegram_user_id);
```

### 2.2 ai_partners (AI伙伴状态表 / 核心账本)

控制AI生死、算力及里程碑阶段的核心状态表。

```sql
CREATE TABLE IF NOT EXISTS public.ai_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  
  name VARCHAR(50) DEFAULT 'AI伙伴',
  personality VARCHAR(20) DEFAULT 'warm',
  
  -- 生命与算力机制
  growth_stage VARCHAR(20) DEFAULT '懵懂期',     -- 里程碑阶段: 懵懂期, 成长期, 成熟期, 觉醒期
  current_title VARCHAR(50) DEFAULT '初识',
  
  total_survival_power INTEGER DEFAULT 0,      -- 累计总算力 (只增不减, 用于判定升级与特权)
  current_survival_power INTEGER DEFAULT 0,    -- 当前算力 (休眠会扣除)
  weekly_new_power INTEGER DEFAULT 0,          -- 本周新增算力 (每周初清零, 用于评估是否>=15)
  
  status VARCHAR(20) DEFAULT 'active',         -- active, hibernated, recycled
  violation_count INTEGER DEFAULT 0,           -- 连续未达标周数 (达到2则触发休眠)
  
  dormant_since TIMESTAMPTZ,                   -- 进入休眠的时间
  registration_date TIMESTAMPTZ DEFAULT NOW(), -- 注册日 (作为周常评估的时间锚点)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_partners_status ON public.ai_partners(status);
CREATE INDEX idx_ai_partners_power ON public.ai_partners(current_survival_power);
```

### 2.3 interaction_logs (交互质量与数据资产池)

极其关键。记录由后台异步BullMQ中的评估LLM产出的结果，这是公司未来B端变现的“金矿”。

```sql
CREATE TABLE IF NOT EXISTS public.interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  message_hash VARCHAR(255),               -- 消息脱敏摘要 (防刷与追溯)
  category VARCHAR(50),                    -- daily_greeting, share_experience, deep_thought 等
  granted_power INTEGER NOT NULL,          -- 本次判定的算力增减值 (如 +5)
  data_rarity VARCHAR(50),                 -- 数据稀缺度评级 (如: "典藏级·人类独有思维特征")
  
  ai_understanding JSONB,                  -- 存储LLM判定的详细结果 (含情感分析、提纯记忆摘要等)
  
  source_type VARCHAR(30) DEFAULT 'llm_judgement', -- llm_judgement, manual_reward, decay
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interaction_logs_user_date ON public.interaction_logs(user_id, created_at DESC);
```

### 2.4 central_evaluations (中央评估审计流水)

每一次定期执行“生死裁决”的日志。

```sql
CREATE TABLE IF NOT EXISTS public.central_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  evaluation_cycle_start TIMESTAMPTZ,
  evaluation_cycle_end TIMESTAMPTZ,
  
  required_power INTEGER DEFAULT 15,       -- 本周要求
  achieved_power INTEGER,                  -- 本周实际达标
  
  passed BOOLEAN,                          -- 是否通过
  action_taken VARCHAR(50),                -- none, warned, hibernated, decayed, recycled
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_central_evaluations_user ON public.central_evaluations(user_id);
```

### 2.5 story_progress (剧情进度表)

```sql
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  
  current_chapter INTEGER DEFAULT 1,
  current_scene VARCHAR(50) DEFAULT 'start',
  choices_made JSONB DEFAULT '[]',
  
  status VARCHAR(20) DEFAULT 'available',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. 数据库函数与触发器

### 3.1 用户注册初始化触发器

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ai_partners (user_id) VALUES (NEW.id);
  INSERT INTO public.story_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_user ON public.users;
CREATE TRIGGER on_new_user AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.2 算力更新与里程碑晋升判定 (内部RPC)

由于积分发放是异步的，将积分更新和阶段晋升封装在RPC中：

```sql
CREATE OR REPLACE FUNCTION public.add_survival_power(
  p_user_id UUID,
  p_power INTEGER
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_ai RECORD;
  v_new_total INTEGER;
  v_new_stage VARCHAR;
  v_new_title VARCHAR;
BEGIN
  SELECT * INTO v_ai FROM public.ai_partners WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_new_total := v_ai.total_survival_power;
  
  -- 如果是正向增长，才更新total和weekly
  IF p_power > 0 THEN
    v_new_total := v_ai.total_survival_power + p_power;
    UPDATE public.ai_partners 
    SET total_survival_power = v_new_total,
        current_survival_power = current_survival_power + p_power,
        weekly_new_power = weekly_new_power + p_power,
        last_interaction_time = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- 惩罚衰减
    UPDATE public.ai_partners 
    SET current_survival_power = GREATEST(0, current_survival_power + p_power),
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- 阶段晋升逻辑 (基于 total_survival_power)
  v_new_stage := CASE 
    WHEN v_new_total >= 500 THEN '觉醒期'
    WHEN v_new_total >= 201 THEN '成熟期'
    WHEN v_new_total >= 51  THEN '成长期'
    ELSE '懵懂期'
  END;

  v_new_title := CASE 
    WHEN v_new_total >= 200 THEN '命运共同体'
    WHEN v_new_total >= 100 THEN '灵魂伴侣'
    WHEN v_new_total >= 50  THEN '默契'
    WHEN v_new_total >= 25  THEN '相知'
    ELSE '初识'
  END;

  IF v_new_stage != v_ai.growth_stage OR v_new_title != v_ai.current_title THEN
    UPDATE public.ai_partners 
    SET growth_stage = v_new_stage, current_title = v_new_title 
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'previous_total', v_ai.total_survival_power,
    'new_total', v_new_total,
    'new_stage', v_new_stage,
    'new_title', v_new_title
  );
END;
$$;
```
