# 数据库设置指南

## 方式 1：使用 Podman（推荐，开源方案）

Podman 是一个完全开源的容器运行时，可以作为 Docker 的替代品。

### 1. 安装 Podman

**macOS**:
```bash
brew install podman
podman machine init
podman machine start
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install podman
```

### 2. 启动 PostgreSQL 容器

**方式 A：使用 podman compose（推荐）**
```bash
cd /path/to/dushu
podman compose up -d
```

**方式 B：直接使用 podman run**
```bash
podman run --name dushu-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dushu \
  -p 5432:5432 \
  -d postgres:15
```

### 3. 验证容器运行

```bash
podman ps | grep dushu-postgres
```

### 3. 运行数据库迁移

```bash
cd backend
npx prisma migrate dev --name init
```

## 方式 2：使用本地 PostgreSQL

### 1. 安装 PostgreSQL

- macOS: `brew install postgresql@15`
- Ubuntu: `sudo apt-get install postgresql postgresql-contrib`
- Windows: 从 [PostgreSQL 官网](https://www.postgresql.org/download/) 下载安装

### 2. 创建数据库

```bash
# 启动 PostgreSQL 服务
# macOS: brew services start postgresql@15
# Linux: sudo systemctl start postgresql

# 创建数据库
createdb dushu

# 或者使用 psql
psql -U postgres
CREATE DATABASE dushu;
\q
```

### 3. 更新 .env 文件

确保 `backend/.env` 中的 `DATABASE_URL` 正确：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dushu?schema=public"
```

### 4. 运行数据库迁移

```bash
cd backend
npx prisma migrate dev --name init
```

## 方式 3：使用 Podman Compose（最简单）

项目根目录已包含 `docker-compose.yml`（Podman 兼容），直接运行：

```bash
# 使用 podman compose（Podman 4.0+）
podman compose up -d

# 或使用 podman-compose（需要单独安装）
podman-compose up -d
```

然后运行迁移：

```bash
cd backend
npx prisma migrate dev --name init
```

## 验证数据库连接

运行以下命令测试连接：

```bash
cd backend
npx prisma db pull
```

如果成功，说明数据库连接正常。

## 常用命令

- 查看数据库状态：`npx prisma studio`（打开 Prisma Studio 可视化工具）
- 重置数据库：`npx prisma migrate reset`
- 查看迁移历史：`npx prisma migrate status`

