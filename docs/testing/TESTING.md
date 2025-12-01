# 测试指南

## 当前运行状态

### 后端 API
- **地址**: http://localhost:3001
- **健康检查**: http://localhost:3001/api/health
- **状态**: ✅ 运行中

### 前端应用
- **地址**: http://localhost:5173
- **状态**: ✅ 运行中

### 数据库
- **容器**: dushu-postgres
- **端口**: 5432
- **状态**: ✅ 运行中

## 测试步骤

### 1. 测试后端 API

#### 健康检查接口
```bash
curl http://localhost:3001/api/health
```

**预期响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-01T00:23:06.212Z"
}
```

#### 使用浏览器测试
打开浏览器访问: http://localhost:3001/api/health

### 2. 测试前端应用

#### 访问首页
打开浏览器访问: http://localhost:5173

**预期看到**:
- 页面标题："历史阅读增强 App"
- 系统状态卡片，显示后端 API 连接状态
- 如果连接成功，显示绿色 ✅ 标记和服务器时间

#### 测试 API 连接
1. 在首页查看"系统状态"卡片
2. 应该显示"✅ 连接正常"
3. 点击"重新检查"按钮测试连接

### 3. 测试数据库连接

#### 使用 Prisma Studio
```bash
cd backend
npx prisma studio
```

浏览器会自动打开 http://localhost:5555，可以：
- 查看所有数据库表
- 查看表结构和数据
- 手动添加/编辑数据（用于测试）

#### 使用命令行
```bash
cd backend
# 查看数据库状态
npx prisma db pull

# 查看迁移状态
npx prisma migrate status
```

## 功能测试清单

### ✅ 已完成功能

- [x] 后端服务器启动
- [x] 健康检查 API
- [x] CORS 配置
- [x] 前端应用启动
- [x] React Router 路由
- [x] Mantine UI 组件
- [x] React Query 数据获取
- [x] API 客户端配置
- [x] 前后端连接测试

### 🚧 待开发功能

- [ ] 章节列表 API
- [ ] 阅读页面
- [ ] 人物管理
- [ ] 关系图谱
- [ ] 地图视图
- [ ] LLM 问答

## 常见问题

### 问题 1: 前端无法连接后端

**检查**:
1. 确认后端服务器正在运行（`cd backend && npm run dev`）
2. 检查 `frontend/src/lib/api.ts` 中的 `API_BASE_URL`
3. 检查浏览器控制台的错误信息

**解决**:
- 如果后端在不同端口，更新 `.env` 文件或 `api.ts` 中的 URL

### 问题 2: CORS 错误

**检查**:
- 后端 `src/index.ts` 中是否配置了 `app.use(cors())`

**解决**:
- 如果仍有问题，可以配置更详细的 CORS 选项

### 问题 3: 数据库连接失败

**检查**:
```bash
# 检查容器是否运行
podman ps | grep dushu-postgres

# 检查数据库连接
cd backend
npx prisma db pull
```

**解决**:
- 如果容器未运行: `podman-compose up -d`
- 如果连接失败: 检查 `.env` 中的 `DATABASE_URL`

## 下一步开发

完成基础测试后，可以开始：

1. **Milestone 2**: 数据准备与内容管理后台
   - LLM 批量提取脚本
   - 管理后台登录
   - Review 工具

2. **Milestone 3**: 核心阅读功能
   - 章节列表
   - 阅读界面
   - 段落交互

详见 [../development/roadmap.md](../development/roadmap.md)

