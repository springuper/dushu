#!/bin/bash

# 数据库设置脚本（使用 Podman）

echo "🚀 开始设置数据库..."

# 检查 Podman 是否安装
if command -v podman &> /dev/null; then
    echo "✅ Podman 已安装"
    
    # 检查是否可以使用 podman compose
    if podman compose version &> /dev/null; then
        echo "📦 使用 podman compose 启动数据库..."
        cd "$(dirname "$0")/../.."
        podman compose up -d
    # 检查是否可以使用 podman-compose
    elif command -v podman-compose &> /dev/null; then
        echo "📦 使用 podman-compose 启动数据库..."
        cd "$(dirname "$0")/../.."
        podman-compose up -d
    # 否则直接使用 podman run
    else
        echo "📦 使用 podman run 启动数据库..."
        # 检查容器是否已存在
        if podman ps -a | grep -q dushu-postgres; then
            echo "📦 数据库容器已存在，启动中..."
            podman start dushu-postgres
        else
            echo "📦 创建数据库容器..."
            podman run --name dushu-postgres \
              -e POSTGRES_USER=postgres \
              -e POSTGRES_PASSWORD=postgres \
              -e POSTGRES_DB=dushu \
              -p 5432:5432 \
              -d postgres:15
        fi
    fi
    
    echo "⏳ 等待数据库启动..."
    sleep 5
    
    # 检查容器是否运行
    if podman ps | grep -q dushu-postgres; then
        echo "✅ 数据库容器运行中"
    else
        echo "❌ 数据库容器启动失败"
        exit 1
    fi
else
    echo "⚠️  Podman 未安装，请手动设置 PostgreSQL 数据库"
    echo "   安装: brew install podman (macOS) 或 sudo apt-get install podman (Linux)"
    echo "   参考: backend/DATABASE_SETUP.md"
    exit 1
fi

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
cd "$(dirname "$0")/.."
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
    echo "✅ 数据库设置完成！"
    echo ""
    echo "📊 可以使用以下命令查看数据库："
    echo "   npx prisma studio"
else
    echo "❌ 数据库迁移失败"
    exit 1
fi

