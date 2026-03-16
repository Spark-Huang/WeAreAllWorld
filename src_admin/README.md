# src_admin - 管理后台

大同世界管理后台，包含三个子项目。

## 目录结构

```
src_admin/
├── admin/              # Vite 管理前端
│   ├── src/
│   │   ├── App.tsx     # 主应用
│   │   └── Login.tsx   # 登录组件
│   └── package.json
├── admin-panel/        # 管理后台后端
│   ├── src/
│   │   └── index.ts    # 服务入口
│   └── package.json
└── web/                # Web Admin UI (含 Dockerfile)
    ├── src/
    │   └── Admin.tsx
    └── Dockerfile
```

## 子项目说明

### admin/
基于 Vite + React 的管理前端，提供：
- 用户管理
- AI 伙伴状态监控
- 贡献值统计
- 定时任务管理

```bash
cd src_admin/admin
pnpm dev    # 开发模式 (端口 5174)
pnpm build  # 构建
```

### admin-panel/
管理后台后端服务，负责：
- OpenClaw 实例管理
- New API Token 管理
- 用户计费

```bash
cd src_admin/admin-panel
pnpm dev    # 开发模式 (端口 3002)
```

### web/
Web Admin UI，带 Dockerfile 用于容器化部署。

```bash
cd src_admin/web
pnpm dev    # 开发模式
docker build -t admin-web .  # 构建 Docker 镜像
```

## 访问

| 服务 | 端口 | 说明 |
|------|------|------|
| admin | 5174 | 管理前端 |
| admin-panel | 3002 | 管理后端 |
| web | 5175 | Web Admin UI |