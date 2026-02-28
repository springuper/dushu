#!/bin/bash
# 设置环境变量文件

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "设置环境变量"
echo "=========================================="
echo ""

# 目标文件：backend/.env（与后端共用）
ENV_FILE="$PROJECT_ROOT/backend/.env"

# 检查 .env 文件是否存在
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  backend/.env 文件已存在"
    read -p "是否覆盖？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消操作"
        exit 0
    fi
fi

# 从 backend/.env.example 复制到 backend/.env
if [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
    cp "$PROJECT_ROOT/backend/.env.example" "$ENV_FILE"
    echo "✅ 已从 backend/.env.example 创建 backend/.env 文件"
else
    echo "❌ 错误: backend/.env.example 文件不存在"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 环境变量文件已创建"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 编辑 backend/.env 文件，填入实际的 API Key 和 DATABASE_URL"
echo "  2. 运行: nano backend/.env 或 vim backend/.env"
echo ""
echo "提示："
echo "  - GOOGLE_API_KEY: 从 https://makersuite.google.com/app/apikey 获取"
echo "  - OPENAI_API_KEY: 从 https://platform.openai.com/api-keys 获取"
echo ""

