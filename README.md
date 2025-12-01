# 历史阅读增强 App

基于 TypeScript + React + Node.js 的历史阅读增强 Web App。

## 技术栈

### 前端
- Vite + React + TypeScript
- Mantine UI 组件库
- React Query 数据管理
- React Router 路由

### 后端
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM

## 快速开始

> 📖 **详细设置指南**：请先阅读 [QUICK_START.md](./QUICK_START.md)

### 前置要求

- Node.js (v18+)
- PostgreSQL (v15+) 或 Podman（开源容器运行时）

### 快速开始

#### 1. 安装依赖

```bash
# 安装所有依赖（根目录、前端、后端）
npm run install:all
```

#### 2. 生成 Prisma Client（首次使用或更新 schema 后）

```bash
cd backend
npx prisma generate
```

#### 3. 启动开发服务器

```bash
# 在项目根目录，同时启动前端和后端
npm run dev
```

这会在以下地址启动服务：
- 前端：http://localhost:5173（如果被占用会自动使用下一个端口）
- 后端：http://localhost:3001

#### 3. 单独启动（可选）

如果需要单独启动某个服务：

```bash
# 只启动前端
npm run dev:frontend

# 只启动后端
npm run dev:backend
```

### 数据库设置

#### 方式 1：使用 Podman Compose（推荐，开源方案）

```bash
# 安装 Podman（如果还没有）
# macOS: brew install podman
# Linux: sudo apt-get install podman

# 启动 PostgreSQL 数据库
podman compose up -d
# 或使用: podman-compose up -d

# 运行数据库迁移
cd backend
npx prisma migrate dev --name init
```

**注意**：项目使用 Podman（开源容器运行时）而不是 Docker。`docker-compose.yml` 文件与 Podman 完全兼容。

#### 方式 2：使用本地 PostgreSQL

1. 安装并启动 PostgreSQL
2. 创建数据库：`createdb dushu`
3. 运行迁移：`cd backend && npx prisma migrate dev --name init`

详细说明请参考 [backend/DATABASE_SETUP.md](./backend/DATABASE_SETUP.md)

### 环境变量

后端需要创建 `.env` 文件（已自动生成）：

```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dushu?schema=public"
NODE_ENV=development
```

**注意**：如果使用 Podman Compose，`DATABASE_URL` 已配置为默认值。如果使用本地 PostgreSQL，请根据实际情况修改。

## 项目结构

```
dushu/
├── frontend/          # 前端项目（Vite + React + TypeScript）
├── backend/           # 后端项目（Express + TypeScript + Prisma）
├── specs/             # 产品规格文档
├── roadmap.md         # 开发路线图
├── package.json       # 根目录统一脚本
└── README.md          # 项目说明
```

## 可用脚本

在项目根目录运行：

- `npm run dev` - 同时启动前端和后端开发服务器
- `npm run dev:frontend` - 只启动前端
- `npm run dev:backend` - 只启动后端
- `npm run install:all` - 安装所有依赖
- `npm run build` - 构建前端和后端
- `npm run lint` - 检查所有代码
- `npm run format` - 格式化所有代码

## 开发进度

当前阶段：Milestone 2 - 数据准备与内容管理后台（进行中）

**已完成**：
- ✅ Milestone 1: 项目基础搭建
- ✅ 管理后台身份验证
- ✅ 管理后台基础布局

**进行中**：
- 🚧 Review 工具
- 🚧 批量导入功能
- 🚧 内容管理基础

详见 [roadmap.md](./roadmap.md)

