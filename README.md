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

#### 2. 启动数据库

**使用 Podman Compose（推荐）**：
```bash
# 启动 PostgreSQL 数据库
podman compose up -d
# 或使用: podman-compose up -d
```

**使用本地 PostgreSQL**：
确保 PostgreSQL 已安装并运行，并创建数据库：
```bash
createdb dushu
```

#### 3. 运行数据库迁移

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

#### 4. 启动开发服务器

```bash
# 在项目根目录，同时启动前端和后端
npm run dev
```

这会在以下地址启动服务：
- 前端：http://localhost:5173（如果被占用会自动使用下一个端口）
- 后端：http://localhost:3001

**注意**：确保数据库已启动（见步骤 2），否则后端将无法连接数据库。

#### 5. 单独启动（可选）

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

#### 后端环境变量

后端和脚本统一使用 `backend/.env`：

```bash
# 从模板创建 backend/.env
./scripts/setup_env.sh

# 编辑填入配置
nano backend/.env
```

需配置项：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dushu?schema=public"
# LLM 二选一
GOOGLE_API_KEY=your-api-key-here
# OPENAI_API_KEY=your-openai-api-key-here
```

**注意**：`backend/.env` 已加入 `.gitignore`。参考 `backend/.env.example` 了解所有可配置项。

## 项目结构

```
dushu/
├── frontend/          # 前端项目（Vite + React + TypeScript）
├── backend/           # 后端项目（Express + TypeScript + Prisma）
├── specs/             # 产品规格文档（Spec）
│   ├── reading-app-spec.md              # 主产品规格
│   └── data-acquisition-and-merge-spec.md  # 数据获取与融合规格
├── docs/              # 项目文档（使用指南、开发文档）
│   ├── setup/         # 设置和快速开始指南
│   ├── development/   # 开发相关文档（路线图等）
│   ├── data/          # 数据相关文档（数据来源、推荐书籍等）
│   └── testing/       # 测试相关文档
├── scripts/           # 工具脚本（LLM 提取、Playwright 下载等）
├── venv/              # Python 虚拟环境（自动生成，已加入 .gitignore）
├── data/              # 数据目录（原始文本、处理后的数据等）
├── package.json       # 根目录统一脚本
└── README.md          # 项目说明
```

## 数据准备工具

项目中的数据准备脚本包括：

### Node.js 脚本（文本下载和预处理）

文本下载和预处理脚本使用 Node.js：

```bash
# 安装依赖（如果还没有）
npm install
npx playwright install chromium

# 使用下载脚本
node scripts/download_with_playwright.js \
  --url "https://zh.wikisource.org/wiki/史記/卷008" \
  --output "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --book "史记" \
  --chapter "高祖本纪"

# 使用预处理脚本
node scripts/preprocess_text.js \
  --input "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --output "data/processed/chapters/shiji_01_gaozu_benji.json" \
  --book "史记" \
  --chapter "高祖本纪"
```

**或使用自动脚本**：
```bash
./scripts/download_first_chapter_auto.sh
```

### Node.js 脚本（文本预处理）

文本预处理脚本使用 Node.js：

```bash
# 使用预处理脚本
node scripts/preprocess_text.js \
  --input "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --output "data/processed/chapters/shiji_01_gaozu_benji.json" \
  --book "史记" \
  --chapter "高祖本纪"
```

### Python 脚本（LLM 提取）

LLM 提取脚本需要 Python 环境：

```bash
# 创建虚拟环境（如果还没有）
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt

# 运行 Python 脚本
python scripts/extract_with_llm.py ...
```

**注意**：便捷脚本（如 `extract_data.sh`）会自动激活虚拟环境，无需手动激活。

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
  - ✅ LLM 驱动的数据融合
  - ✅ 变更日志系统

**下一步**：
- 🔄 夯实 Milestone 1 & 2 功能
- 📚 准备历史书籍数据（详见 [docs/data/DATA_SOURCES.md](./docs/data/DATA_SOURCES.md)）

详见 [docs/development/roadmap.md](./docs/development/roadmap.md)

## 文档导航

### 产品规格（Specs）

- **[specs/reading-app-spec.md](./specs/reading-app-spec.md)** - 主产品规格书
- **[specs/data-acquisition-and-merge-spec.md](./specs/data-acquisition-and-merge-spec.md)** - 数据获取与融合规格书

### 使用指南

- **[docs/setup/QUICK_START.md](./docs/setup/QUICK_START.md)** - 快速开始指南
- **[docs/data/DATA_SOURCES.md](./docs/data/DATA_SOURCES.md)** - 数据来源说明
- **[docs/data/RECOMMENDED_BOOKS.md](./docs/data/RECOMMENDED_BOOKS.md)** - 推荐书籍
- **[docs/OPERATION_MANUAL.md](./docs/OPERATION_MANUAL.md)** - 完整操作手册（数据准备到发布）
- **[scripts/INCREMENTAL_WORKFLOW.md](./scripts/INCREMENTAL_WORKFLOW.md)** - 渐进式工作流指南

### 开发文档

- **[docs/development/roadmap.md](./docs/development/roadmap.md)** - 开发路线图
- **[docs/testing/TESTING.md](./docs/testing/TESTING.md)** - 测试指南

### 工具脚本

- **[scripts/README.md](./scripts/README.md)** - 脚本使用说明

## 数据来源

本项目使用的历史书籍数据均来自公共领域（Public Domain），可以自由使用。

**推荐资源**：
- 📖 [维基文库](https://zh.wikisource.org) - 免费古籍文本
- 📖 [中国哲学书电子化计划](https://ctext.org) - 高质量古籍资源

**详细说明**：请查看 [docs/data/DATA_SOURCES.md](./docs/data/DATA_SOURCES.md)

**推荐书籍**（聚焦秦汉/西汉）：请查看 [docs/data/RECOMMENDED_BOOKS.md](./docs/data/RECOMMENDED_BOOKS.md)

**数据准备流程**：
- 技术规范：请查看 [specs/data-acquisition-and-merge-spec.md](./specs/data-acquisition-and-merge-spec.md)
- 操作指南：请查看 [docs/OPERATION_MANUAL.md](./docs/OPERATION_MANUAL.md) 和 [scripts/INCREMENTAL_WORKFLOW.md](./scripts/INCREMENTAL_WORKFLOW.md)

**测试指南**：请查看 [docs/testing/TESTING.md](./docs/testing/TESTING.md)
