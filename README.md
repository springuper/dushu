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

> 📖 **详细设置指南**：请先阅读 [docs/setup/QUICK_START.md](./docs/setup/QUICK_START.md)

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
├── docs/              # 项目文档
│   ├── setup/         # 设置和快速开始指南
│   ├── development/   # 开发相关文档（路线图等）
│   ├── data/          # 数据相关文档（数据来源、推荐书籍等）
│   └── testing/       # 测试相关文档
├── specs/             # 产品规格文档
├── scripts/           # 工具脚本（LLM 提取、Playwright 下载等）
├── venv/              # Python 虚拟环境（自动生成，已加入 .gitignore）
├── data/              # 数据目录（原始文本、处理后的数据等）
├── package.json       # 根目录统一脚本
└── README.md          # 项目说明
```

## Python 环境设置（数据准备工具）

项目中的数据准备脚本（Playwright 下载、LLM 提取）需要 Python 环境。

### 首次设置

```bash
# 运行设置脚本（会自动创建虚拟环境并安装依赖）
./scripts/setup_python_env.sh
```

### 使用虚拟环境

```bash
# 激活虚拟环境
source venv/bin/activate

# 运行 Python 脚本
python scripts/download_with_playwright.py ...

# 退出虚拟环境
deactivate
```

**注意**：便捷脚本（如 `download_first_chapter_auto.sh`）会自动激活虚拟环境，无需手动激活。

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

当前阶段：Milestone 2 - 数据准备与内容管理后台（已完成）

**已完成**：
- ✅ Milestone 1: 项目基础搭建
- ✅ Milestone 2: 数据准备与内容管理后台
  - ✅ 管理后台身份验证
  - ✅ 管理后台基础布局
  - ✅ Review 工具（列表、详情、批量操作）
  - ✅ 批量导入功能
  - ✅ 内容管理基础（人物/关系/地点/事件）
  - ✅ LLM 批量提取脚本

**下一步**：
- 🔄 夯实 Milestone 1 & 2 功能
- 📚 准备历史书籍数据（详见 [docs/data/DATA_SOURCES.md](./docs/data/DATA_SOURCES.md)）

详见 [docs/development/roadmap.md](./docs/development/roadmap.md)

## 数据来源

本项目使用的历史书籍数据均来自公共领域（Public Domain），可以自由使用。

**推荐资源**：
- 📖 [维基文库](https://zh.wikisource.org) - 免费古籍文本
- 📖 [中国哲学书电子化计划](https://ctext.org) - 高质量古籍资源

**详细说明**：请查看 [docs/data/DATA_SOURCES.md](./docs/data/DATA_SOURCES.md)

**推荐书籍**（聚焦秦汉/西汉）：请查看 [docs/data/RECOMMENDED_BOOKS.md](./docs/data/RECOMMENDED_BOOKS.md)

**数据准备流程**：请查看 [scripts/prepare_data.md](./scripts/prepare_data.md)

**测试指南**：请查看 [docs/testing/TESTING.md](./docs/testing/TESTING.md)

