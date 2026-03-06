# 0. OpenClaw 是什么？（写给完全不了解的人员）

这部分是为不熟悉 OpenClaw 的同学准备的“产品/技术背景速览”，和后面的架构设计文档可以一起看。

## 0.1 一句话概括

- OpenClaw 是一个「开源的、可以自己部署的 AI 助手/智能体平台」，  
- 它不仅仅是“陪你聊天”的机器人，而是能在你自己的服务器或电脑上，真正帮你“干活”的 AI：  
  - 控制浏览器、访问网页  
  - 操作文件、执行命令  
  - 收发邮件、管理日程  
  - 安装各种“技能（Skills）”来扩展能力【turn0search0】【turn0search6】【turn0search32】

## 0.2 用通俗一点的理解类比

你可以把它想象成这样几个东西的组合：

- “大脑”：  
  - OpenClaw 自己不提供模型，而是对接各种大模型（如 GPT、Claude、通义千问等）来做理解和推理。  
- “手和脚”：  
  - 通过 Skills（插件）和本地工具，去操作浏览器、文件系统、邮件、Shell 命令等。  
- “记事本/大脑外存”：  
  - 把用户的偏好、历史对话、重要信息记在本地文件里（Markdown/JSONL），形成长期记忆。  
- “调度中心/网关（Gateway）”：  
  - 作为控制平面，把来自 Telegram、WhatsApp、飞书等各种聊天平台的消息，路由给内部的 Agent，再返回结果【turn0search0】【turn0search3】。

对用户来说：  
- OpenClaw 更像一个“数字员工 / 远程运维助手”，而不仅仅是聊天机器人。

## 0.3 OpenClaw 的几个核心特性

### 1）本地优先 / 自托管

- OpenClaw 设计上就是“跑在你自己的环境里”：  
  - 可以跑在：个人电脑（Mac / Windows / Linux）、家庭服务器、云服务器（VPS）、Kubernetes 集群等【turn0search6】【turn0search32】。  
- 数据（配置、对话、记忆、技能）主要存储在本地 workspace 目录中：  
  - 如 `~/.openclaw/workspace`，配置在 `~/.openclaw/config.yml` 等【turn0search1】【turn0search12】。

对本项目的意义：  
- 我们要做的就是“帮 C 端用户托管这些 OpenClaw 实例”，每个用户一个隔离环境。

### 2）多平台接入（聊天工具）

- OpenClaw 通过 Gateway 接入主流聊天工具，比如：  
  - Telegram  
  - WhatsApp  
  - Discord / Slack  
  - 飞书、企业微信、钉钉等【turn0search6】【turn0search8】【turn0search33】  
- 你只需要在这些聊天软件里和 OpenClaw 对话，就能让它替你执行任务。

对本项目的意义：  
- 我们现在先选 Telegram 做试点，将来可以扩展到更多平台。

### 3）记忆系统（短期 + 长期）

OpenClaw 的记忆很有特点，大致分两层【turn0search7】【turn0search16】：

- 短期记忆：  
  - 每次对话的记录，以 JSONL 或日志方式保存，保证当前对话的连续性。  
- 长期记忆：  
  - 把重要的信息、偏好、项目背景等写入 Markdown 文件（如 MEMORY.md、USER.md）。  
  - 查询时结合“关键词搜索 + 向量搜索”，从这些文件里找到相关记忆片段【turn0search7】【turn0search16】。

对本项目的意义：  
- 每个租户的 OpenClaw 容器都有自己独立的“记忆文件”，彼此完全隔离。

### 4）技能系统（Skills）——它最关键的部分

- OpenClaw 的强大之处在 Skills（插件/技能）【turn0search5】【turn0search15】：  
  - 每一个 Skill 是一个“能力包”，比如：  
    - “查天气”  
    - “自动浏览网页并抓取数据”  
    - “管理 GitHub PR / 自动部署”  
    - “收发邮件、管理日历”  
  - 社区有大量现成的 Skills，可以直接使用（类似插件商店）。  
  - 开发者也可以自己写 Skills（通常是一个配置文件 + 脚本），让 AI 学会新能力【turn0search14】【turn0search15】。

对本项目的意义：  
- 后续我们可以为 C 端用户提供一组“安全、官方精选”的 Skills，不需要用户自己写代码。

### 5）高权限 + 自动化执行

- 和只会在网页里回答问题的 ChatGPT/Claude 不同：  
  - OpenClaw 具有较高的系统权限（由部署者赋予），可以：  
    - 执行 Shell 命令  
    - 读写本地文件  
    - 打开浏览器、点击页面元素、填表单、爬数据【turn0search0】【turn0search8】  
- 它可以配置定时任务（cron）、心跳巡检（heartbeat），实现 7×24 小时自动跑任务，比如：  
  - 每天早上整理收件箱  
  - 定期抓取某些网站的信息并总结【turn0search2】【turn0search8】。

对本项目的意义：  
- 这也是为什么我们在架构中要特别强调安全、隔离、配额和 RBAC 的原因：  
  - 每个用户的 OpenClaw 都是一个“有执行权限的沙箱环境”。

## 0.4 OpenClaw 的典型部署形态

- 个人玩的时候，通常是这样：  
  - 在自己电脑 / Mac mini / 一台云服务器上，用 Docker 或直接安装 OpenClaw；  
  - 配置好大模型 API（如 OpenAI、Claude、国内厂商模型）；  
  - 在 Telegram/WhatsApp/飞书中绑定，然后就可以跟它对话、让它干活【turn0search2】【turn0search8】【turn0search27】。

- 在 Kubernetes 集群上部署时：  
  - 一般是把 OpenClaw 打包成容器：  
    - 配置文件（config.yml）  
    - workspace 目录（挂载 PVC）  
    - Skills 目录（插件）  
    - Gateway 端口（默认 18789）【turn0search1】【turn0search12】。  
  - 然后通过 Deployment/Service 等资源管理生命周期【turn0search18】【turn0search26】。

对本项目的意义：  
- 我们在云服务 CCE 上做的事情，本质上是：  
  - 把“个人用户手动在自己机器上部署 OpenClaw”的过程，变成一个多租户 SaaS：  
    - 用户一键注册/绑定  
    - 后端自动为每个用户创建独立的 OpenClaw 容器 + 存储卷  
    - 用户只负责在 Telegram 上聊天，其余全托管。

## 0.5 外包团队至少需要记住的几个关键点

1）OpenClaw 是什么  
   - 开源自托管的 AI 助手 / 智能体平台，不是简单的聊天机器人。  
   - 跑在容器里，需要配置：工作目录、配置文件、Gateway 端口、大模型 API Key、Skills。

2）为什么我们会用到 Kubernetes  
   - 每个用户需要一个独立的 OpenClaw 实例（1 个 Pod + 1 个 PVC）。  
   - 用 K8s 是为了方便：  
     - 统一创建/销毁、升级、扩容这些容器；  
     - 做资源配额、网络策略、RBAC 安全隔离；  
     - 方便后续多用户、多集群扩展。

3）OpenClaw 在本项目里的角色

   - 它是“干活的核心引擎”：  
     - 接收来自 Telegram 的消息（经由我们的 Bot 网关）；  
     - 调用大模型进行推理；  
     - 使用内置或自定义 Skills 执行任务（浏览器、文件、邮件等）；  
     - 把结果和状态写回 Gateway，由我们的 Bot 网关发回 Telegram。  
   - Supabase + 云服务 CCE 围绕着它做：  
     - 用户管理（Auth + profiles 表）  
     - 实例管理（instances 表 + Edge Function）  
     - 容器编排（Deployment/PVC/Secret/Service）。

