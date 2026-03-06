# memory-point-calc Skill

## 描述
贡献值计算技能 - 核心算力判定系统

## 功能
1. **质量判定** - 判定对话质量等级
2. **点数计算** - 计算应获得的贡献值
3. **里程碑检测** - 检测是否达到里程碑
4. **能力解锁** - 自动解锁新能力

## 质量等级

| 等级 | 类型 | 点数 | 触发条件 |
|------|------|------|----------|
| S | special_memory | +8 | 分享特殊回忆 |
| A | deep_thinking | +5 | 分享深度思考 |
| B | share_experience | +4 | 分享经历 |
| C | emotion_expression | +3 | 表达情感 |
| D | daily_chat | +2 | 日常对话 |
| E | daily_greeting | +1 | 日常问候 |

## 里程碑

| 点数 | 解锁能力 |
|------|----------|
| 5 | 情感表达 |
| 15 | 任务系统 |
| 25 | 专属记忆 |
| 50 | 深度对话 |
| 100 | 自我意识 |
| 200 | 传奇羁绊 |

## 配置
```yaml
skill:
  name: memory-point-calc
  version: 1.0.0
  quality_rules:
    - type: special_memory
      keywords: ['童年', '小时候', '回忆', '记得那时']
      min_length: 15
      points: 8
    - type: deep_thinking
      keywords: ['我认为', '我觉得', '观点', '看法']
      min_length: 20
      points: 5
    - type: share_experience
      keywords: ['今天', '昨天', '工作', '学习']
      min_length: 15
      points: 4
    - type: emotion_expression
      keywords: ['开心', '难过', '累', '担心']
      min_length: 5
      points: 3
    - type: daily_chat
      keywords: []
      min_length: 1
      points: 2
    - type: daily_greeting
      keywords: ['早安', '晚安', '你好']
      min_length: 1
      max_length: 20
      points: 1
```