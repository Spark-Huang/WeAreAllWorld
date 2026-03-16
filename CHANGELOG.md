# 变更日志

所有重要的变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 项目目录结构重构
- 所有目录添加 README 文档
- 开源必备文件（CONTRIBUTING.md, CODE_OF_CONDUCT.md 等）

### 变更
- 整理测试目录结构（scripts/, src_test/, test-results/ -> tests/）
- 整理非核心目录（supabase/ -> infra/, 美术资源/ -> assets/）
- 修复构建错误

## [1.0.0] - 2026-03-10

### 新增
- AI 伙伴养成系统
- 贡献值系统
- 质量判定系统
- 休眠机制
- 里程碑解锁
- 5 章剧情系统
- 国际化支持（中英文）
- Telegram Bot 支持
- OpenClaw Pod 集成
- 管理后台

### 技术栈
- 前端：Vite + React + Tailwind CSS
- 后端：Node.js + Express + TypeScript
- 数据库：Supabase (PostgreSQL)
- LLM：GLM-5 (OpenAI API 兼容)
- 容器：Kubernetes + Docker

---

[Unreleased]: https://github.com/Spark-Huang/WeAreAllWorld/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Spark-Huang/WeAreAllWorld/releases/tag/v1.0.0