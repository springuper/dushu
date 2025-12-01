# 快速开始指南

## 前置要求

在开始之前，你需要：

1. **Node.js** (v18 或更高版本)
2. **PostgreSQL 数据库** (v15 或更高版本)

## 数据库安装选项

### 选项 1：使用 Podman（推荐，开源方案）

Podman 是一个完全开源的容器运行时，可以作为 Docker 的替代品。

#### macOS
```bash
# 安装 Podman
brew install podman

# 初始化 Podman 机器（首次使用）
podman machine init
podman machine start

# 启动数据库
cd /Users/shangchun/Documents/Repo/dushu
podman compose up -d
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install podman podman-compose

# 启动数据库
cd /path/to/dushu
podman compose up -d
```

**注意**：如果 `podman compose` 不可用，可以安装 `podman-compose`：
```bash
# macOS
pip3 install podman-compose

# Linux
sudo pip3 install podman-compose

# 然后使用
podman-compose up -d
```

### 选项 2：使用 Homebrew（macOS）

```bash
# 安装 PostgreSQL
brew install postgresql@15

# 启动 PostgreSQL 服务
brew services start postgresql@15

# 创建数据库
createdb dushu
```

### 选项 3：使用包管理器（Linux）

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql

# 创建数据库（以 postgres 用户）
sudo -u postgres createdb dushu
```

### 选项 4：从官网下载（所有平台）

访问 [PostgreSQL 官网](https://www.postgresql.org/download/) 下载并安装。

## 设置步骤

### 1. 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd ../backend
npm install
```

### 2. 配置数据库连接

编辑 `backend/.env` 文件，确保 `DATABASE_URL` 正确：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dushu?schema=public"
```

**注意**：根据你的 PostgreSQL 配置，可能需要修改用户名和密码。

### 3. 运行数据库迁移

```bash
cd backend
npx prisma migrate dev --name init
```

这会：
- 创建数据库表
- 生成 Prisma Client
- 创建初始迁移文件

### 4. 启动开发服务器

**终端 1 - 后端**：
```bash
cd backend
npm run dev
```

**终端 2 - 前端**：
```bash
cd frontend
npm run dev
```

### 5. 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001
- 健康检查：http://localhost:3001/api/health

## 验证数据库连接

运行以下命令打开 Prisma Studio（可视化数据库管理工具）：

```bash
cd backend
npx prisma studio
```

浏览器会自动打开 http://localhost:5555

## 常见问题

### 问题 1：无法连接到数据库

**解决方案**：
1. 确认 PostgreSQL 服务正在运行
2. 检查 `DATABASE_URL` 中的用户名、密码、端口是否正确
3. 确认数据库 `dushu` 已创建

### 问题 2：迁移失败

**解决方案**：
```bash
# 重置数据库（会删除所有数据）
cd backend
npx prisma migrate reset

# 然后重新运行迁移
npx prisma migrate dev --name init
```

### 问题 3：端口被占用

**解决方案**：
- 修改 `backend/.env` 中的 `PORT` 值
- 或停止占用端口的进程

## 下一步

数据库设置完成后，可以开始：
- Milestone 2：数据准备与内容管理后台
- 详见 [../development/roadmap.md](../development/roadmap.md)

