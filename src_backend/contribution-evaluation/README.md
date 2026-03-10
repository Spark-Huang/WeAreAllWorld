# 贡献值判定与中央评估的共生规则系统
# Contribution Value Judgment and Central Evaluation Symbiotic Rule System

## 概述

这是天下一家（WeAreAll.World）的核心规则系统，负责：
- 用户交互质量的判定与评分
- 贡献值的计算与累积
- 每周中央评估与状态管理
- AI伙伴的休眠、唤醒与回收机制

## 目录结构

```
contribution-evaluation/
├── index.ts                    # 模块入口
├── README.md                   # 本文档
├── services/                   # 核心服务
│   ├── quality-judge.service.ts    # 质量判定服务
│   ├── memory-points.service.ts    # 贡献值计算服务
│   ├── central-evaluation.service.ts # 中央评估服务
│   └── scheduled-task.service.ts   # 定时任务服务
├── types/                      # 类型定义
│   └── index.ts                   # 核心类型
└── database/                   # 数据库
    ├── schema.sql              # 表结构
    ├── functions.sql           # 存储函数
    ├── triggers.sql            # 触发器
    └── deploy.sql              # 完整部署脚本
```

## 核心概念

### 贡献值 (Contribution)

用户与AI伙伴交互所获得的积分，反映用户对AI成长的贡献程度。

**三种类型：**
- `total_contribution`: 累计贡献值（只增不减，用于里程碑）
- `current_contribution`: 当前贡献值（休眠会扣除）
- `weekly_contribution`: 本周新增贡献值（评估核算用，每周重置）

### 质量类型 (Quality Types)

| 类型 | 点数 | 数据稀缺度标签 |
|------|------|----------------|
| `special_memory` | 6-8 | [绝版·专属生命记忆] |
| `deep_thought` | 5 | [典藏级·人类独有思维特征] |
| `experience` | 4 | [珍贵·人类行为样本] |
| `emotion` | 3 | [稀有·真实情感图谱] |
| `daily` | 2 | 活跃数据 |
| `greeting` | 1 | 普通数据 |

### 里程碑 (Milestones)

| 累计贡献值 | 称号 | 解锁能力 |
|-----------|------|----------|
| 10 | 初识 | - |
| 25 | 相知 | exclusive_memory (专属记忆主动提及) |
| 50 | 默契 | deep_conversation (深度对话) |
| 100 | 灵魂伴侣 | self_awareness (自我意识) |
| 200 | 命运共同体 | - |
| 500 | 永恒伙伴 | - |
| 1000 | 超越者 | - |

### AI状态 (Status)

- `active`: 活跃状态
- `hibernated`: 休眠状态（连续2周未达标）
- `recycled`: 回收状态（贡献值归零）

### 每周评估规则

**难度模式：**
- `easy`: 每周需 ≥5 点
- `standard`: 每周需 ≥15 点
- `hard`: 每周需 ≥45 点

**评估结果：**
- 通过 → 发放活跃奖励，重置违规计数
- 未通过（第1次）→ 警告，violation_count = 1
- 未通过（第2次）→ 进入休眠

### 每周活跃奖励

| 活跃度等级 | 本周贡献值 | 奖励点数 |
|-----------|-----------|---------|
| basic | ≥15 | +5 |
| active | ≥30 | +10 |
| deep | ≥50 | +15 |

### 休眠衰减

休眠期间，每天扣除贡献值：
- `easy`: -1 点/天
- `standard`: -2 点/天
- `hard`: -3 点/天

贡献值归零时，AI进入 `recycled` 状态。

## 数据库函数

### 核心函数

| 函数名 | 描述 |
|--------|------|
| `update_contribution` | 更新贡献值并检查里程碑 |
| `process_daily_checkin` | 处理每日签到 |
| `run_weekly_evaluation` | 执行每周评估 |
| `run_hibernation_decay` | 执行休眠衰减 |
| `wakeup_ai` | 唤醒休眠/回收的AI |
| `get_weekly_stats` | 获取本周统计 |
| `get_user_full_info` | 获取用户完整信息 |

## 测试

```bash
# 运行基础功能测试
npm run test:db

# 运行安全渗透测试
npm run test:security
```

## 安全考虑

1. **SQL注入防护**: 使用参数化查询
2. **权限隔离**: RLS策略阻止跨用户访问
3. **数据完整性**: 外键约束、唯一约束、CHECK约束
4. **审计追踪**: 所有评估操作记录在 central_evaluations 表

## 版本历史

- v2.1 (2026-03-07): 字段名改为 contribution，新增安全测试
- v2.0 (2026-03-06): 重构为三层架构
- v1.0 (2026-03-05): 初始版本