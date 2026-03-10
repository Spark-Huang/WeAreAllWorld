# MEMORY.md - 长期记忆

## 项目：大同世界 (WeAreAllWorld)

### 项目概述
- **名称**: 大同世界 (原名: 大同世界)
- **GitHub**: https://github.com/Spark-Huang/WeAreAllWorld
- **路径**: `/root/.openclaw/workspace/WeAreAllWorld`
- **技术栈**: TypeScript, Supabase, Node.js, React, Kubernetes

### 核心功能
1. **贡献值系统** - 用户通过对话、签到获得贡献值
2. **AI伙伴** - 每个用户有专属AI伙伴，随贡献值成长
3. **质量判定** - 分析对话质量（特殊回忆、深度思考、情感表达等）
4. **休眠机制** - 长期不活跃用户AI进入休眠，贡献值衰减
5. **里程碑系统** - 达到贡献值里程碑解锁AI能力
6. **剧情系统** - 5章剧情引导用户与AI建立羁绊
7. **OpenClaw 集成** - 每个用户自动分配专属 OpenClaw Pod

### 目录结构
```
WeAreAllWorld/
├── src_backend/          # 后端代码 (Node.js + Express)
│   ├── api/              # REST API
│   ├── services/         # 业务服务
│   └── contribution-evaluation/  # 贡献值评估
├── src_frontend/         # 用户前端 (React + Vite)
├── src_admin/            # 管理后台 (React + Vite)
├── admin-panel/          # 管理后台后端 (独立部署)
├── scripts/              # 测试脚本
├── memory/               # 每日工作日志
└── docs/                 # 文档
```

### Kubernetes 部署
- **Namespace**: `we-are-all-world`
- **OpenClaw**: 每用户专属 Pod，使用华为云 GLM-5 模型
- **API URL**: `https://api.modelarts-maas.com/openai/v1`
- **Provider**: `hwc_maas/glm-5`

### 环境变量
```
API_KEY=weareallworld_dev_key_2026
SUPABASE_URL=https://kmbmfzehpjjctvuagecd.supabase.co
HWC_MAAS_API_KEY=-FGQj0REdnpigSmUjjHH6O4h7Z-anoAOCiMGhzbdgZIw97SHtfnXtYERnbvuxyGzqNKgX2l5d7n4wf8kikhuhg
HWC_MAAS_BASE_URL=https://api.modelarts-maas.com/openai/v1
```

### 测试状态 (2026-03-10)
- **单元测试**: 55/55 通过 (100%)
- **端到端测试**: 26/26 通过 (100%)
- **用户旅程**: 全流程通过

### 已完成
- [x] 目录结构重构
- [x] OpenClaw K8s 部署
- [x] 华为云 GLM-5 模型集成
- [x] API Key 认证修复
- [x] 完整测试套件通过

### 待办
- [ ] 配置生产环境部署
- [ ] 清理测试数据
- [ ] 前端 UI 测试
