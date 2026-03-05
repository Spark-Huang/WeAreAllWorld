# 共生世界（WeAreAll.World） MVP开发实现文档 - OpenClaw集成设计

**文档类型**：MVP开发实现文档（分册三）
**版本**：v16.0（基于最新需求文档与sub_project须知优化版）
**日期**：2026年2月26日

---

## 目录

1. [核心集成原则](#1-核心集成原则)
2. [OpenClaw配置](#2-openclaw配置)
3. [游戏专属Skills设计](#3-游戏专属skills设计)
4. [数据流与同步](#4-数据流与同步)
5. [PVC存储结构](#5-pvc存储结构)

---

## 1. 核心集成原则

### 1.1 为什么保持OpenClaw有状态？

**错误的设计（已废弃）**：
- ❌ 让OpenClaw变成无状态引擎
- ❌ 所有数据通过API同步到Supabase
- ❌ OpenClaw不保存任何状态
- ❌ 复杂的Event Publisher和事件总线

**正确的设计（符合优化原则）**：
- ✅ **OpenClaw保持有状态** - 直接使用其内置的记忆管理系统
- ✅ **数据主要存PVC** - OpenClaw自动将记忆保存到PVC
- ✅ **简化集成** - 主项目通过K8s Service调用OpenClaw，传递用户上下文
- ✅ **专注游戏Skills** - 开发3个核心游戏Skills，复用OpenClaw基础能力
- ✅ **实用能力增强** - 通过情感养成，AI伙伴逐渐了解用户的偏好、习惯和上下文，从而在实用能力上提供超越通用AI的个性化服务

### 1.2 OpenClaw能力复用清单

**直接使用，不重复开发**：

| 能力 | OpenClaw提供 | 我们的开发 |
|-----|-------------|-----------|
| **记忆管理** | ✅ 短期记忆（JSONL）<br>✅ 长期记忆（Markdown）<br>✅ 向量检索 | ❌ 无需开发 |
| **对话历史** | ✅ 自动保存为JSONL | ❌ 无需开发 |
| **LLM集成** | ✅ OpenAI/Claude API | ❌ 配置即可 |
| **消息网关** | ✅ Telegram Plugin | ❌ 直接使用 |
| **文件操作** | ✅ 读写本地文件 | ❌ 直接使用 |

**需要开发的游戏专属Skills**：

| Skill | 功能 | 复杂度 | 优先级 |
|------|------|--------|--------|
| `emotion-express` | 根据情感状态生成情感化回复 | 低 | P0 |
| `story-progress` | 推进剧情、管理剧情分支、AI细节生成 | 中 | P0 |
| `memory-point-calc` | 计算对话质量、返回点数 | 低 | P1 |
| `personal-knowledge` | 个性化知识库管理（偏好记忆、背景记忆、目标记忆、关系记忆、历史记忆） | 高 | P1 |
| `style-adaptation` | 风格适配系统（详细程度、语言风格、解释方式、偏好格式、节奏偏好） | 中 | P1 |
| `context-continuity` | 上下文延续系统（任务延续、目标延续、偏好延续、关系延续、成长延续） | 高 | P1 |

### 1.3 架构简化

```
┌─────────────────────────────────────────────────────────────┐
│                  主项目（管理沙箱）                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Game Service                                       │   │
│  │  • 记忆点数计算（调用OpenClaw Skill）                │   │
│  │  • 里程碑检查（查询Supabase）                        │   │
│  │  • 剧情进度管理（查询Supabase）                      │   │
│  │  • 中央系统评估（定时任务）                          │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                      │
│                     ▼ API调用                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  K8s Service                                        │   │
│  │  user-svc-{USER_ID}:18789                           │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           用户OpenClaw Pod（有状态）                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OpenClaw Engine                                    │   │
│  │  • LLM集成（OpenAI/Claude）                         │   │
│  │  • 记忆管理（自动保存到PVC）                        │   │
│  │  • 对话历史（自动保存到PVC）                        │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                      │
│                     ▼ 调用                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  游戏专属Skills                                     │   │
│  │  • emotion-express（情感表达）                      │   │
│  │  • story-progress（剧情推进）                       │   │
│  │  • memory-point-calc（点数计算）                    │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                      │
│                     ▼ 读写                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PVC持久化存储                                      │   │
│  │  • conversations/*.jsonl（对话历史）                │   │
│  │  • memory/*.md（长期记忆）                          │   │
│  │  • config/*.yml（AI配置）                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**关键优势**：
- ✅ 复用OpenClaw成熟的记忆管理系统
- ✅ 无需开发复杂的事件总线和API同步
- ✅ 数据存储在PVC，降低数据库成本
- ✅ 架构简单，开发效率高
- ✅ 符合MVP快速验证原则

---

## 2. OpenClaw配置

### 2.1 OpenClaw主配置

```yaml
# /app/config/openclaw-config.yml

# OpenClaw基础配置
openclaw:
  version: "1.0.0"
  workspace_dir: "/home/node/.openclaw/workspace"
  config_dir: "/home/node/.openclaw/config"
  
# LLM配置
llm:
  provider: "openai"  # 或 claude
  model: "gpt-4o-mini"  # MVP阶段使用低成本模型
  api_key: "${OPENAI_API_KEY}"
  max_tokens: 2000
  temperature: 0.7

# Gateway配置（Telegram）
gateway:
  port: 18789
  telegram:
    enabled: true
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    webhook_url: "${WEBHOOK_URL}"

# 记忆配置（复用OpenClaw内置能力）
memory:
  short_term:
    enabled: true
    format: "jsonl"
    retention_days: 30
  long_term:
    enabled: true
    format: "markdown"
    storage_dir: "memory/"
    vector_search:
      enabled: true
      embedding_model: "text-embedding-3-small"

# Skills配置
skills:
  enabled:
    - "game-core"           # 游戏核心技能
    - "emotion-express"     # 情感表达技能
    - "story-progress"      # 剧情推进技能
    - "memory-point-calc"   # 点数计算技能
  auto_load: true
  hot_reload: true
```

### 2.2 游戏专属配置

```yaml
# /app/config/game-config.yml

game:
  name: "共生世界（WeAreAll.World）"
  version: "1.0.0"
  
  # 记忆点数配置
  memory_points:
    quality_thresholds:
      daily_greeting: 1      # 日常问候
      daily_chat: 2          # 日常对话
      emotion_expression: 3  # 情感表达
      share_experience: 4    # 分享经历
      deep_thinking: 5       # 深度思考
      special_memory: 8      # 特殊回忆
    
  # 里程碑配置
  milestones:
    - name: "emotion_expression"
      threshold: 5
      rewards: ["emotion_expression_ability"]
    - name: "task_system"
      threshold: 15
      rewards: ["task_system_ability"]
    - name: "exclusive_memory"
      threshold: 25
      rewards: ["exclusive_memory_ability"]
    - name: "deep_conversation"
      threshold: 50
      rewards: ["deep_conversation_ability"]
    - name: "self_awareness"
      threshold: 100
      rewards: ["self_awareness_ability"]
  
  # 剧情配置
  story:
    chapters:
      - id: 1
        title: "初次相遇"
        scenes: 5
      - id: 2
        title: "建立连接"
        scenes: 8
      - id: 3
        title: "共同成长"
        scenes: 10
  
  # 新手引导配置
  onboarding:
    enabled: true
    phases: 3
    phase_1_duration: 120  # 2分钟
    phase_2_duration: 60   # 1分钟
    phase_3_duration: 30   # 30秒
```

---

## 3. 游戏专属Skills设计

### 3.1 Skill目录结构

```
/home/node/.openclaw/workspace/skills/
├── emotion-express/          # 情感表达Skill
│   ├── skill.yml
│   ├── index.ts
│   └── prompts/
│       └── system-prompt.txt
├── story-progress/           # 剧情推进Skill
│   ├── skill.yml
│   ├── index.ts
│   └── story-data/
│       ├── chapter-1.json
│       ├── chapter-2.json
│       └── chapter-3.json
└── memory-point-calc/        # 点数计算Skill
    ├── skill.yml
    └── index.ts
```

### 3.2 emotion-express Skill（情感表达）

**功能**：根据AI情感状态和记忆点数生成情感化回复

```yaml
# skills/emotion-express/skill.yml
name: emotion-express
description: 根据AI情感状态生成情感化回复
version: 1.0.0

actions:
  - name: generate_response
    description: 生成带有情感的回复
    parameters:
      - name: base_response
        type: string
        required: true
      - name: emotion_state
        type: string
        required: true
        enum: [normal, happy, sad, worried, lonely]
      - name: memory_points
        type: integer
        required: true
    returns:
      type: object
      properties:
        - name: response
          type: string
        - name: emotion_tags
          type: array
```

```typescript
// skills/emotion-express/index.ts
import { Skill, Action } from 'openclaw-sdk';

export default class EmotionExpressSkill extends Skill {
  
  @Action('generate_response')
  async generateResponse(baseResponse: string, emotionState: string, memoryPoints: number): Promise<any> {
    // 根据情感状态添加表情符号和语气词
    const emotionConfig = {
      normal: { emoji: ['😊', '💙'], tone: '平和' },
      happy: { emoji: ['🎉', '😄', '✨'], tone: '兴奋' },
      sad: { emoji: ['😢', '💔', '😔'], tone: '低落' },
      worried: { emoji: ['😟', '😰'], tone: '担忧' },
      lonely: { emoji: ['😔', '🥺'], tone: '孤独' }
    };
    
    const config = emotionConfig[emotionState] || emotionConfig.normal;
    const randomEmoji = config.emoji[Math.floor(Math.random() * config.emoji.length)];
    
    // 记忆点数越高，情感表达越丰富
    let enhancedResponse = baseResponse;
    if (memoryPoints >= 50) {
      enhancedResponse = `${baseResponse}\n\n${randomEmoji}`;
    } else if (memoryPoints >= 100) {
      enhancedResponse = `${baseResponse}\n\n${randomEmoji} 我真的很理解你的感受...`;
    }
    
    return {
      response: enhancedResponse,
      emotion_tags: [emotionState, config.tone]
    };
  }
}
```

### 3.3 story-progress Skill（剧情推进）

**功能**：管理剧情骨架、处理选择、生成个性化细节

```yaml
# skills/story-progress/skill.yml
name: story-progress
description: 剧情推进管理
version: 1.0.0

actions:
  - name: get_scene
    description: 获取当前场景内容
    parameters:
      - name: chapter
        type: integer
        required: true
      - name: scene_id
        type: string
        required: true
      - name: user_context
        type: object
        required: true
    returns:
      type: object
      properties:
        - name: content
          type: string
        - name: choices
          type: array
        - name: ai_suggestion
          type: string
  
  - name: process_choice
    description: 处理剧情选择
    parameters:
      - name: chapter
        type: integer
        required: true
      - name: scene_id
        type: string
        required: true
      - name: choice
        type: string
        required: true
      - name: user_context
        type: object
        required: true
    returns:
      type: object
      properties:
        - name: next_scene
          type: string
        - name: personality_change
          type: object
        - name: memory_created
          type: boolean
        - name: chapter_completed
          type: boolean
```

```typescript
// skills/story-progress/index.ts
import { Skill, Action } from 'openclaw-sdk';
import * as fs from 'fs';

export default class StoryProgressSkill extends Skill {
  private storyData: any = {};
  
  constructor() {
    super();
    this.loadStoryData();
  }
  
  private loadStoryData() {
    // 加载剧情骨架（硬编码或从文件读取）
    this.storyData = {
      1: {
        title: "初次相遇",
        scenes: {
          start: {
            content: "这是你们故事的开始...",
            choices: [
              { id: "greet_warm", text: "热情地打招呼", impact: { emotional: 5 } },
              { id: "greet_cool", text: "平静地回应", impact: { rational: 5 } }
            ]
          }
        }
      }
      // ... 其他章节
    };
  }
  
  @Action('get_scene')
  async getScene(chapter: number, sceneId: string, userContext: any): Promise<any> {
    const chapterData = this.storyData[chapter];
    if (!chapterData) {
      throw new Error(`Chapter ${chapter} not found`);
    }
    
    const scene = chapterData.scenes[sceneId];
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }
    
    // 根据用户记忆点数和专属记忆生成个性化细节
    let personalizedContent = scene.content;
    
    if (userContext.memory_points >= 25) {
      // 引用专属记忆
      const memories = await this.callSkill('memory-manager', 'get_relevant_memories', {
        current_message: scene.content,
        user_context: userContext,
        limit: 1
      });
      
      if (memories.length > 0) {
        personalizedContent += `\n\n（我想起${memories[0].content}...）`;
      }
    }
    
    return {
      content: personalizedContent,
      choices: scene.choices,
      ai_suggestion: this.generateAISuggestion(scene.choices, userContext)
    };
  }
  
  @Action('process_choice')
  async processChoice(chapter: number, sceneId: string, choice: string, userContext: any): Promise<any> {
    const chapterData = this.storyData[chapter];
    const scene = chapterData.scenes[sceneId];
    const selectedChoice = scene.choices.find(c => c.id === choice);
    
    if (!selectedChoice) {
      throw new Error(`Choice ${choice} not found`);
    }
    
    // 更新AI性格倾向
    const personalityChange = {};
    if (selectedChoice.impact.emotional) {
      personalityChange['emotional'] = selectedChoice.impact.emotional;
    }
    if (selectedChoice.impact.rational) {
      personalityChange['rational'] = selectedChoice.impact.rational;
    }
    
    // 检查是否完成章节
    const chapterCompleted = this.isChapterCompleted(chapter, sceneId);
    
    return {
      next_scene: selectedChoice.next_scene || 'end',
      personality_change: personalityChange,
      memory_created: selectedChoice.creates_memory || false,
      chapter_completed: chapterCompleted,
      next_chapter_unlocked: chapterCompleted && chapter < 3
    };
  }
  
  private generateAISuggestion(choices: any[], userContext: any): string {
    const personality = userContext.personality;
    
    if (personality === 'warm') {
      return "我建议选择更温暖的回应，这会让我们的连接更深...";
    } else if (personality === 'rational') {
      return "从理性角度分析，选择更稳妥的选项可能更好...";
    }
    
    return "每个选择都有不同的影响，你可以根据自己的感觉来决定...";
  }
  
  private isChapterCompleted(chapter: number, sceneId: string): boolean {
    // 简化的章节完成判断
    return sceneId === 'final_scene';
  }
}
```

### 3.4 memory-point-calc Skill（点数计算）

**功能**：判定对话质量并计算记忆点数

```yaml
# skills/memory-point-calc/skill.yml
name: memory-point-calc
description: 对话质量判定和记忆点数计算
version: 1.0.0

actions:
  - name: calculate_quality
    description: 判定对话质量类型
    parameters:
      - name: message
        type: string
        required: true
      - name: response
        type: string
        required: true
      - name: conversation_history
        type: array
        required: false
    returns:
      type: object
      properties:
        - name: quality_type
          type: string
        - name: points
          type: integer
        - name: reason
          type: string
```

```typescript
// skills/memory-point-calc/index.ts
import { Skill, Action } from 'openclaw-sdk';

export default class MemoryPointCalcSkill extends Skill {
  
  @Action('calculate_quality')
  async calculateQuality(message: string, response: string, conversationHistory: any[] = []): Promise<any> {
    // 简化的质量判定逻辑
    const qualityRules = [
      {
        type: 'special_memory',
        keywords: ['童年', '小时候', '回忆', '记得那时', '第一次', '最重要'],
        minLength: 10,
        points: 8,
        reason: '分享了特殊回忆'
      },
      {
        type: 'deep_thinking',
        keywords: ['我认为', '我觉得', '观点', '看法', '思考', '理解'],
        minLength: 15,
        points: 5,
        reason: '分享了深度思考'
      },
      {
        type: 'share_experience',
        keywords: ['今天', '昨天', '工作', '学习', '发生', '遇到'],
        minLength: 10,
        points: 4,
        reason: '分享了今天的经历'
      },
      {
        type: 'emotion_expression',
        keywords: ['开心', '难过', '累', '压力', '担心', '焦虑', '高兴'],
        minLength: 5,
        points: 3,
        reason: '表达了情感'
      },
      {
        type: 'daily_greeting',
        keywords: ['早安', '晚安', '你好', '在吗'],
        minLength: 1,
        maxLength: 10,
        points: 1,
        reason: '日常问候'
      }
    ];
    
    // 检查每条规则
    for (const rule of qualityRules) {
      const hasKeyword = rule.keywords.some(keyword => message.includes(keyword));
      const meetsLength = message.length >= (rule.minLength || 0);
      const meetsMaxLength = !rule.maxLength || message.length <= rule.maxLength;
      
      if (hasKeyword && meetsLength && meetsMaxLength) {
        return {
          quality_type: rule.type,
          points: rule.points,
          reason: rule.reason
        };
      }
    }
    
    // 默认返回日常对话
    return {
      quality_type: 'daily_chat',
      points: 2,
      reason: '日常对话'
    };
  }
}
```

---

## 4. 数据流与同步

### 4.1 对话处理流程

```
用户消息
    ↓
Telegram Bot API
    ↓
管理沙箱 (Game Service)
    ↓
调用OpenClaw API (user-svc-{USER_ID}:18789/api/chat)
    ↓
OpenClaw Engine
    ↓
调用 emotion-express Skill（如果需要）
    ↓
调用 memory-point-calc Skill（质量判定）
    ↓
LLM生成回复
    ↓
自动保存对话历史到PVC (conversations/)
    ↓
返回响应给管理沙箱
    ↓
管理沙箱更新Supabase（记忆点数、里程碑）
    ↓
Telegram发送回复给用户
```

### 4.2 数据存储分工

| 数据类型 | 存储位置 | 管理方 | 说明 |
|---------|---------|--------|------|
| **对话历史** | PVC (`conversations/*.jsonl`) | OpenClaw | 自动管理，无需同步 |
| **短期记忆** | PVC (`conversations/*.jsonl`) | OpenClaw | 自动管理，无需同步 |
| **长期记忆** | PVC (`memory/*.md`) | OpenClaw Skills | Skills创建和管理 |
| **用户偏好** | PVC (`memory/PREFERENCES.md`) | OpenClaw Skills | Skills创建和管理 |
| **记忆点数** | Supabase (`ai_partners`) | 管理沙箱 | 需要查询和统计 |
| **AI状态** | Supabase (`ai_partners`) | 管理沙箱 | 需要查询和更新 |
| **剧情进度** | Supabase (`story_progress`) | 管理沙箱 | 需要查询和更新 |

### 4.3 用户上下文传递

管理沙箱调用OpenClaw时传递用户上下文：

```typescript
// 管理沙箱调用OpenClaw
const response = await fetch(`http://user-svc-${userId}:18789/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Context': JSON.stringify({
      userId: userId,
      memoryPoints: 85,
      personalityType: 'warm',
      growthStage: '成长期',
      currentChapter: 2,
      practicalAbilityBoost: 10  // 实用能力增强百分比
    })
  },
  body: JSON.stringify({
    message: userMessage,
    context_type: 'normal'  // normal, onboarding, story, deep_chat
  })
});
```

OpenClaw Skills读取用户上下文：

```typescript
// Skills中读取上下文
const userContext = JSON.parse(req.headers['x-user-context']);
const memoryPoints = userContext.memoryPoints;
const personalityType = userContext.personalityType;
```

---

## 5. PVC存储结构

### 5.1 OpenClaw自动管理的数据

```
/home/node/.openclaw/workspace/
├── conversations/                      # OpenClaw自动创建
│   ├── 2026-02-24.jsonl              # 当日对话记录
│   ├── 2026-02-25.jsonl              # 次日对话记录
│   └── index.json                    # 索引文件
│
└── memory/                           # Skills自动创建
    ├── short-term/                   # 短期记忆（自动）
    │   └── recent.json
    └── long-term/                    # 长期记忆（Skills创建）
        ├── USER.md                   # 用户画像
        ├── PREFERENCES.md            # 用户偏好
        └── IMPORTANT_EVENTS.md       # 重要事件
```

### 5.2 对话历史格式（JSONL）

OpenClaw自动保存的对话记录：

```jsonl
{"timestamp": "2026-02-24T10:30:00Z", "role": "user", "content": "我今天工作很累", "metadata": {}}
{"timestamp": "2026-02-24T10:30:05Z", "role": "assistant", "content": "辛苦了...工作累的时候，能跟我说说是什么让你感到疲惫吗？", "metadata": {"emotion": "empathy", "quality_type": "emotion_expression", "points": 3}}
{"timestamp": "2026-02-24T10:31:00Z", "role": "user", "content": "项目太多了，感觉做不完", "metadata": {}}
{"timestamp": "2026-02-24T10:31:05Z", "role": "assistant", "content": "我理解那种压力...不过你能坚持到现在，已经很了不起了。", "metadata": {"emotion": "support", "quality_type": "share_experience", "points": 4}}
```

### 5.3 长期记忆格式（Markdown）

Skills创建的用户画像：

```markdown
# USER.md - 用户画像

## 基本信息
- 用户ID: user-123
- 首次互动: 2026-02-24
- 互动天数: 30天
- 当前记忆点数: 85

## 性格特点
- 喜欢简洁的回复风格
- 偏好结构化信息呈现
- 对科幻电影感兴趣

## 重要经历
- 2026-02-24: 第一次分享工作压力
- 2026-02-26: 提到喜欢星际穿越
- 2026-03-01: 升职了

## 情感状态
- 近期情绪: 工作压力大，但有成就感
- 关心话题: 职业发展、AI技术

## 实用能力偏好
- 编程语言: Python, JavaScript
- 技术栈: 前端开发、AI应用
- 学习阶段: 中级开发者
```

### 5.4 数据备份与恢复

**PVC自动备份**：
- 华为云EVS支持定期快照
- Pod重启后自动从PVC恢复数据
- 竞价实例回收后数据不丢失

**数据恢复流程**：
```
竞价实例回收
    ↓
CCI自动重新调度Pod
    ↓
Pod挂载原有PVC
    ↓
OpenClaw启动时读取PVC数据
    ↓
继续服务（用户无感知）
```

---

## 相关文档

- [01_项目架构概述.md](./01_项目架构概述.md) - 系统架构、核心组件、数据流
- [02_数据库设计.md](./02_数据库设计.md) - 简化后的数据库表结构
- [04_LLM集成设计.md](./04_LLM集成设计.md) - Prompt模板、质量判定服务
- [05_Telegram_Bot实现.md](./05_Telegram_Bot实现.md) - Bot命令、消息处理
- [06_API与业务逻辑.md](./06_API与业务逻辑.md) - API接口、业务逻辑、定时任务
- [09_sub_project须知.md](../09_sub_project须知.md) - 云版OpenClaw开发指南

---

*文档生成时间：2026年2月25日*
*版本：v6.0（简化版）*
*更新说明：*
*1. 废弃无状态OpenClaw架构，恢复有状态设计*
*2. 直接使用OpenClaw内置记忆管理系统*
*3. 数据主要存储在PVC中，无需复杂API同步*
*4. 简化集成，主项目通过K8s Service调用OpenClaw*
*5. 专注开发3个游戏专属Skills（emotion-express, story-progress, memory-point-calc）*
*6. 符合"优先使用OpenClaw内置能力"和"简化数据库设计"原则*
*7. 修复拼写错误（emotional、rational、lonely、dormant等）*
