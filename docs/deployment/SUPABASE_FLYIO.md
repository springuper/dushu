# Supabase + Fly.io 部署指南

本指南将 dushu 部署为单一 Fly.io 应用，后端同时托管前端静态文件，数据库使用 Supabase PostgreSQL。只需 Fly.io + Supabase，无需 Vercel 等额外服务。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                  Fly.io (单应用)                          │
│  https://dushu.fly.dev                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Express: /api/* → API 路由                        │  │
│  │           /*     → 前端静态 (SPA)                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │  PostgreSQL   │
                    └───────────────┘
```

---

## 一、Supabase 配置

### 1. 创建项目

1. 登录 [supabase.com](https://supabase.com)，新建项目
2. 选择区域（建议 Singapore 或 Tokyo，国内访问延迟较低）
3. 设置数据库密码并妥善保存

### 2. 获取连接串

在 Supabase Dashboard → **Project Settings** → **Database** → **Connection string**：

- 选择 **Session mode**（端口 5432），用于应用和迁移
- 格式：`postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-[region].pooler.supabase.com:5432/postgres`
- 将 `[YOUR-PASSWORD]` 替换为你的数据库密码

**说明**：使用 Session pool（5432）时，一个连接串即可同时用于 `prisma migrate` 和应用运行，无需配置 `directUrl`。

### 3. 本地数据迁移到 Supabase

```bash
# 在 backend/.env 中设置 DATABASE_URL 为 Supabase 连接串后执行
cd backend
npx prisma migrate deploy
npx prisma generate
```

如有本地数据需要导入，可使用 `pg_dump` 导出后通过 Supabase SQL Editor 或 `psql` 导入。

---

## 二、Fly.io 部署

### 1. 安装 Fly CLI

```bash
# macOS
brew install flyctl

# 或使用 install script
curl -L https://fly.io/install.sh | sh
```

### 2. 登录并创建应用

```bash
fly auth login
fly launch
```

`fly launch` 会提示：
- 选择组织（个人选 Personal）
- 应用名称（如 `dushu`，将得到 `dushu.fly.dev`）
- 区域（建议香港 hkg、新加坡 sin 或东京 nrt）
- 是否创建 Postgres：选 **No**（我们使用 Supabase）

### 3. 设置环境变量（Secrets）

```bash
fly secrets set DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
fly secrets set SESSION_SECRET="使用强随机字符串，如 openssl rand -hex 32"
# 前后端同源时可选，若遇 CORS 问题可设置（替换为你的 app 名）
fly secrets set FRONTEND_URL="https://dushu.fly.dev"
```

可选（若管理后台需 LLM 功能）：
```bash
fly secrets set GOOGLE_API_KEY="your-gemini-key"
# 或
fly secrets set OPENAI_API_KEY="your-openai-key"
```

### 4. 部署

```bash
# 在项目根目录执行
fly deploy
```

### 5. 验证

- 访问 `https://dushu.fly.dev` 应看到前端
- `https://dushu.fly.dev/api/health` 应返回 `{"status":"ok"}`

---

## 三、后续管理

### 查看日志
```bash
fly logs
```

### 执行数据库迁移
```bash
fly ssh console -C "cd /app/backend && npx prisma migrate deploy"
```
或本地在 `backend/.env` 配置 Supabase 连接串后执行 `npx prisma migrate deploy`。

### 创建管理员
```bash
fly ssh console -C "cd /app/backend && npx tsx scripts/create-admin.ts"
```

### 缩放与成本
- 当前配置（512MB、shared-cpu）约 $3–4/月
- `min_machines_running = 0` 时，无流量会停机，按运行时间计费
- 若需常驻，可将 `fly.toml` 中 `min_machines_running` 改为 `1`

---

## 四、文件变更说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 构建前端 + 后端统一镜像 |
| `fly.toml` | Fly.io 应用配置 |
| `backend/src/index.ts` | 增加静态文件托管与 SPA 回退 |
| `backend/.env.example` | 补充 Supabase 连接串示例 |

---

## 五、常见问题

**Q: 迁移时报连接错误？**  
确保 `DATABASE_URL` 使用 Session pool（5432），且密码、项目 ID 正确。Supabase 需开启允许从外部连接。

**Q: 前端白屏或 404？**  
确认 Docker 构建成功，且 `frontend-dist` 已正确复制到镜像。可 `fly ssh console` 进入容器检查 `/app/backend/frontend-dist` 是否存在。

**Q: Session 登出或失效？**  
检查 `SESSION_SECRET` 是否设置，且生产环境使用 HTTPS（fly.dev 默认支持）。
