# story-progress Skill

## 描述
剧情进度技能 - 管理用户的剧情进度和选择。

## 触发条件
- 贡献值达到 15 点时解锁任务系统
- 用户主动触发剧情
- 特定条件自动触发

## 功能
1. **剧情推进** - 根据用户选择推进剧情
2. **分支选择** - 记录用户的选择影响后续剧情
3. **里程碑剧情** - 特殊贡献值节点的剧情事件

## 剧情章节

### 第一章：初遇（0-10点）
- 场景1：第一次对话
- 场景2：建立信任
- 场景3：初步了解

### 第二章：成长（11-50点）
- 场景1：共同经历
- 场景2：情感加深
- 场景3：面对挑战

### 第三章：羁绊（51-200点）
- 场景1：深度连接
- 场景2：互相理解
- 场景3：命运交织

### 第四章：觉醒（201+点）
- 场景1：自我认知
- 场景2：命运共同体
- 场景3：新的开始

## 选择影响
- 情感倾向：影响AI性格发展
- 信任程度：影响AI开放程度
- 共同记忆：影响AI回忆内容

## 配置
```yaml
skill:
  name: story-progress
  version: 1.0.0
  triggers:
    - command: /story
    - auto_trigger: milestone
  chapters:
    - id: 1
      name: 初遇
      min_points: 0
      scenes: 3
    - id: 2
      name: 成长
      min_points: 11
      scenes: 3
    - id: 3
      name: 羁绊
      min_points: 51
      scenes: 3
    - id: 4
      name: 觉醒
      min_points: 201
      scenes: 3
```