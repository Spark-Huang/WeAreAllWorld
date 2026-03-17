# 贡献值判定引擎 - 开源模型组合开发草案

> 版本：v1.0  
> 日期：2026-03-16  
> 作者：

---

## 一、项目概述

### 1.1 目标

基于开源预训练模型组合，快速实现贡献值判定引擎 MVP，用于评估用户对话的贡献值。

### 1.2 核心评估维度

```
贡献值 = f(情感深度, 信息价值, 稀缺度)
```

| 维度 | 说明 | 评估方式 |
|-----|-----|---------|
| **情感深度** | 用户情感表达的深度（1-5级） | 情感分类模型 + 规则引擎 |
| **信息价值** | 消息包含的信息量（1-5级） | 语义嵌入 + 文本特征 |
| **稀缺度** | 消息的独特程度（1-5级） | 语义相似度 + 历史统计 |

### 1.3 方案优势

| 维度 | LLM Agent | 开源模型组合 |
|-----|-----------|-------------|
| 开发时间 | 1-2 周 | 2-3 周 |
| 运行成本 | ¥0.03/条 | ¥0.001/条 |
| 延迟 | 1-3s | 50-200ms |
| 离线部署 | ❌ | ✅ |
| 数据隐私 | ⚠️ 上传云端 | ✅ 本地处理 |

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        贡献值判定引擎架构                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐                                                       │
│   │  用户消息   │                                                       │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                      预处理层                                    │  │
│   │  • 文本清洗（去除特殊字符、表情符号标准化）                        │  │
│   │  • 分词（中文 jieba / 英文 spaCy）                               │  │
│   │  • 语言检测（中/英文路由）                                        │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    模型推理层（并行）                             │  │
│   │                                                                  │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│   │  │ 情感分类模型  │  │ 语义嵌入模型  │  │ 文本特征提取  │          │  │
│   │  │              │  │              │  │              │          │  │
│   │  │ 输入: 文本   │  │ 输入: 文本   │  │ 输入: 文本   │          │  │
│   │  │ 输出:        │  │ 输出:        │  │ 输出:        │          │  │
│   │  │ • 情感类型   │  │ • 384维向量  │  │ • 文本长度   │          │  │
│   │  │ • 置信度     │  │              │  │ • 词频统计   │          │  │
│   │  │              │  │              │  │ • 关键词     │          │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│   │         │                  │                  │                 │  │
│   └─────────┼──────────────────┼──────────────────┼─────────────────┘  │
│             │                  │                  │                    │
│             ▼                  ▼                  ▼                    │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                      评分计算层                                  │  │
│   │                                                                  │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│   │  │ 情感深度计算  │  │ 信息价值计算  │  │ 稀缺度计算   │          │  │
│   │  │              │  │              │  │              │          │  │
│   │  │ f(情感类型,  │  │ f(语义向量,  │  │ f(相似度,    │          │  │
│   │  │   置信度,    │  │   文本特征,  │  │   历史统计,  │          │  │
│   │  │   关键词)    │  │   新词比例)  │  │   用户画像)  │          │  │
│   │  │              │  │              │  │              │          │  │
│   │  │ 输出: 1-5级  │  │ 输出: 1-5级  │  │ 输出: 1-5级  │          │  │
│   │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│   │         │                  │                  │                 │  │
│   └─────────┼──────────────────┼──────────────────┼─────────────────┘  │
│             │                  │                  │                    │
│             └──────────────────┼──────────────────┘                    │
│                                ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    贡献值计算层                                  │  │
│   │                                                                  │  │
│   │  贡献值 = 基础分 + 情感深度加成 + 信息价值加成 + 稀缺度加成       │  │
│   │                                                                  │  │
│   │  同时输出：                                                      │  │
│   │  • 消息分类（greeting/daily/emotion/experience/deep/special）    │  │
│   │  • 记忆内容（用于存储到用户画像）                                 │  │
│   │  • AI 学习建议（用于后续 AI 优化）                               │  │
│   │                                                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│                        输出结果（JSON）                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户消息
    │
    ▼
Step 1: 预处理（~5ms）
├── 语言检测
├── 文本清洗
└── 分词
    │
    ▼
Step 2: 模型推理（并行，~100ms）
├── 情感分类模型 → 情感类型 + 置信度
├── 语义嵌入模型 → 384维向量
└── 文本特征提取 → 长度、词频、关键词
    │
    ▼
Step 3: 评分计算（~10ms）
├── 情感深度 = f(情感类型, 置信度, 关键词)
├── 信息价值 = f(语义向量, 文本特征)
└── 稀缺度 = f(相似度, 历史统计)
    │
    ▼
Step 4: 贡献值计算（~5ms）
├── 基础分（根据消息类型）
├── 加成计算
└── 最终贡献值

总延迟：~120ms
```

---

## 三、模型选型

### 3.1 情感分类模型

#### 英文模型

| 模型 | 大小 | 类别数 | 准确率 | 推荐度 |
|-----|-----|-------|-------|-------|
| **`SamLowe/roberta-base-go_emotions`** | 125M | 28 | 95% | ⭐⭐⭐⭐⭐ |
| `j-hartmann/emotion-english-distilroberta-base` | 82M | 7 | 94% | ⭐⭐⭐⭐ |
| `bhadresh-savani/bert-base-uncased-emotion` | 110M | 6 | 93% | ⭐⭐⭐ |

**推荐**：`SamLowe/roberta-base-go_emotions`
- 28 类情感，粒度更细
- 包含 `realization`（顿悟）、`nostalgia`（怀旧）等深度情感
- 准确率最高

#### 中文模型

| 模型 | 大小 | 类别数 | 准确率 | 推荐度 |
|-----|-----|-------|-------|-------|
| **`uer/roberta-base-finetuned-chinanews-chinese`** | 102M | 7 | 92% | ⭐⭐⭐⭐ |
| `touch20032003/xlm-roberta-base-chinese-emotion` | 278M | 7 | 91% | ⭐⭐⭐ |

**推荐**：`uer/roberta-base-finetuned-chinanews-chinese` 或自训练中文情感模型

### 3.2 语义嵌入模型

| 模型 | 大小 | 维度 | 速度 | 推荐度 |
|-----|-----|-----|-----|-------|
| **`sentence-transformers/all-MiniLM-L6-v2`** | 80M | 384 | 极快 | ⭐⭐⭐⭐⭐ |
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | 118M | 384 | 快 | ⭐⭐⭐⭐ |

**推荐**：
- 英文：`all-MiniLM-L6-v2`（最快）
- 中文：`paraphrase-multilingual-MiniLM-L12-v2`（支持多语言）

---

## 四、评分算法

### 4.1 情感深度计算（1-5级）

```python
def compute_emotion_depth(message, emotion_type, confidence):
    """
    1级：表层情绪（如"今天很开心"）
    2级：情感描述（如"开心是因为天气好"）
    3级：情感原因（如"天气好让我觉得生活美好"）
    4级：情感反思（如"我发现好天气对我的心情影响很大"）
    5级：情感洞察（如"我意识到自己是那种容易被环境影响的性格"）
    """
    depth_keywords = {
        5: ["我深刻理解", "我终于明白", "我真正意识到"],
        4: ["我发现", "我意识到", "我注意到"],
        3: ["让我觉得", "让我感到", "是因为"],
        2: ["开心是因为", "难过是因为"]
    }
    
    for depth in [5, 4, 3, 2]:
        if any(kw in message for kw in depth_keywords[depth]):
            return depth
    
    emotion_words = ["开心", "难过", "担心", "生气"]
    if any(w in message for w in emotion_words):
        return 2
    return 1
```

### 4.2 信息价值计算（1-5级）

```python
def compute_info_value(message, embedding, history_embeddings):
    score = 1
    
    # 文本长度
    if len(message) > 50: score += 1
    if len(message) > 100: score += 1
    if len(message) > 200: score += 1
    
    # 信息关键词
    info_keywords = ["经验", "经历", "发现", "学到", "明白", "理解"]
    if any(kw in message for kw in info_keywords):
        score += 1
    
    # 新信息检测
    if history_embeddings:
        similarities = [cosine_similarity(embedding, h) for h in history_embeddings]
        if max(similarities) < 0.5:  # 低相似度 = 新信息
            score += 1
    
    return min(score, 5)
```

### 4.3 稀缺度计算（1-5级）

```python
def compute_scarcity(embedding, history_embeddings):
    if not history_embeddings:
        return 3
    
    similarities = [cosine_similarity(embedding, h) for h in history_embeddings[-50:]]
    max_sim = max(similarities)
    
    if max_sim < 0.3: return 5    # 非常独特
    if max_sim < 0.5: return 4    # 独特
    if max_sim < 0.7: return 3    # 一般
    if max_sim < 0.85: return 2   # 常见
    return 1                       # 非常常见
```

### 4.4 综合贡献值计算

```python
def compute_contribution(emotion_type, emotion_depth, info_value, scarcity):
    # 基础分
    base_scores = {
        "greeting": 1, "daily": 2, "emotion": 3,
        "experience": 4, "deep_thought": 5, "special_memory": 6
    }
    
    # 确定分类
    if emotion_type in ["realization", "nostalgia", "remorse"]:
        category, base = "special_memory", 6
    elif emotion_depth >= 4:
        category, base = "special_memory", 6
    elif emotion_depth >= 3:
        category, base = "deep_thought", 5
    else:
        category, base = "daily", 2
    
    # 加成
    depth_bonus = (emotion_depth - 1) * 0.5
    info_bonus = (info_value - 1) * 0.3
    scarcity_bonus = (scarcity - 1) * 0.3
    
    contribution = base + depth_bonus + info_bonus + scarcity_bonus
    return category, round(contribution, 1)
```

---

## 五、开发计划

### 5.1 时间线（10周）

| 周次 | 任务 | 交付物 |
|-----|-----|-------|
| **Week 1** | 基础架构 + 模型调研 | 项目初始化完成、模型选型报告 |
| **Week 2** | 情感分类模型集成 | 中英文情感分类模块 |
| **Week 3** | 语义嵌入模型集成 | 语义嵌入提取模块 |
| **Week 4** | 评分算法实现 | 评分算法核心逻辑 |
| **Week 5** | 性能优化 | 并行推理、缓存机制 |
| **Week 6** | API 封装 + 测试 | REST API 服务、单元测试 |
| **Week 7** | 集成测试 + 部署 | 集成测试通过、Docker 镜像 |
| **Week 8** | 与后端集成 | 后端集成完成 |
| **Week 9** | A/B 测试 + 效果验证 | 测试报告、效果验证 |
| **Week 10** | 监控 + 文档 | 监控告警配置、完整文档 |



---

## 六、代码结构

```
contribution-evaluation/
├── README.md
├── requirements.txt
├── config/
│   ├── models.yaml          # 模型配置
│   └── scoring.yaml         # 评分配置
├── src/
│   ├── models/
│   │   ├── emotion_classifier.py    # 情感分类模型
│   │   ├── embedding_model.py       # 语义嵌入模型
│   │   └── model_router.py          # 模型路由（中英文）
│   ├── scoring/
│   │   ├── emotion_depth.py         # 情感深度计算
│   │   ├── info_value.py            # 信息价值计算
│   │   ├── scarcity.py              # 稀缺度计算
│   │   └── contribution.py          # 综合贡献值计算
│   ├── preprocessing/
│   │   ├── text_cleaner.py          # 文本清洗
│   │   └── language_detector.py     # 语言检测
│   ├── api/
│   │   ├── main.py                  # FastAPI 主入口
│   │   ├── routes.py                # API 路由
│   │   └── schemas.py               # Pydantic 模型
│   └── utils/
│       ├── cache.py                 # 缓存工具
│       └── metrics.py               # 监控指标
├── tests/
│   ├── test_emotion.py
│   ├── test_scoring.py
│   └── test_api.py
├── scripts/
│   ├── download_models.py           # 下载模型脚本
│   └── benchmark.py                 # 性能测试脚本
├── Dockerfile
└── docker-compose.yml
```

---

## 七、API 设计

### 7.1 评估接口

```yaml
POST /api/v1/evaluate

Request:
{
  "message": "项目上线让我意识到，被认可是我工作的核心动力",
  "user_id": "user_456",
  "history": ["最近在忙一个项目", "听起来很辛苦"]
}

Response:
{
  "contribution_points": 5.8,
  "category": "special_memory",
  "emotion": {
    "type": "realization",
    "depth": 4,
    "intensity": 0.75
  },
  "info_value": 4,
  "scarcity": 3,
  "memory_content": "用户意识到被认可对工作动力很重要",
  "processing_time_ms": 125
}
```

### 7.2 批量评估接口

```yaml
POST /api/v1/evaluate/batch

Request:
{
  "messages": [
    {"message": "今天很开心", "user_id": "user_1"},
    {"message": "项目上线让我意识到...", "user_id": "user_2"}
  ]
}

Response:
{
  "results": [...],
  "total_processing_time_ms": 250
}
```

---

## 八、部署方案

### 8.1 Docker 部署

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 预下载模型
RUN python scripts/download_models.py

COPY . .

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: contribution-evaluator
  namespace: we-are-all-world
spec:
  replicas: 2
  selector:
    matchLabels:
      app: contribution-evaluator
  template:
    spec:
      containers:
      - name: evaluator
        image: contribution-evaluator:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

---

## 九、团队分工

### 9.1 核心模型团队（3人）

| 成员 | 职责 | Week 1 | Week 2 | Week 3 |
|-----|-----|--------|--------|--------|
| **袁同学** | 数据增广 | 评分算法设计 | 算法优化 | 集成测试 |
| **赵同学** | 情感深度模型 | 情感模型集成 | 深度算法优化 | 监控配置 |
| **周同学** | 稀缺度 + 信息价值 | 嵌入模型集成 | 相似度优化 | 文档编写 |

### 9.2 基础设施团队（2人）

| 成员 | 职责 | Week 1 | Week 2 | Week 3 |
|-----|-----|--------|--------|--------|
| **高同学** | 性能优化 | 并行推理实现 | 缓存优化 | 部署配置 |
| **黄同学** | API + 部署 | API 设计 | Docker 配置 | K8s 部署 |

---

## 十、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|-----|-----|-----|---------|
| 模型准确率不足 | 中 | 高 | 准备 LLM 兜底方案 |
| 中文情感模型效果差 | 中 | 中 | 自训练中文模型 |
| 性能不达标 | 低 | 高 | 模型量化、缓存优化 |
| 内存占用过大 | 中 | 中 | 模型卸载、动态加载 |

---

## 十一、后续优化方向

### 短期（1-2个月）
- [ ] 添加更多情感深度特征
- [ ] 优化中文情感模型
- [ ] 实现 LLM 兜底机制

### 中期（3-6个月）
- [ ] 训练专用评估模型
- [ ] 实现在线学习
- [ ] 添加多模态支持

### 长期（6个月+）
- [ ] 模型蒸馏
- [ ] 边缘部署支持
- [ ] 多语言支持

---

## 附录：参考资源

### 开源模型
- [roberta-base-go_emotions](https://huggingface.co/SamLowe/roberta-base-go_emotions)
- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

### 数据集
- [GoEmotions](https://github.com/google-research/google-research/tree/master/goemotions)
- [DailyDialog](http://yanran.li/dataset)
- [ESConv](https://github.com/hkust-cpg/ESConv)
