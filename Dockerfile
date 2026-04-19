# dushu - 前端+后端统一镜像
# 构建: 从项目根目录 docker build -f Dockerfile .

# ========== 阶段 1: 构建前端 ==========
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# 同源部署时 API 用相对路径，空字符串表示当前域名
ENV VITE_API_BASE_URL=
RUN npm run build

# ========== 阶段 2: 构建后端 ==========
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Dummy DATABASE_URL for prisma generate (only schema is needed, not actual connection)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build
# Remove devDependencies for production copy
RUN npm prune --omit=dev

# ========== 阶段 3: 生产镜像 ==========
FROM node:20-alpine
WORKDIR /app

# 后端
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/prisma ./backend/prisma
COPY --from=backend-build /app/backend/prisma.config.ts ./backend/
COPY --from=backend-build /app/backend/tsconfig.json ./backend/
COPY --from=backend-build /app/backend/package*.json ./backend/

# 前端静态文件（放到 backend 可寻路径）
COPY --from=frontend-build /app/frontend/dist ./backend/frontend-dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
