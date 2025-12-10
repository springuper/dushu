#!/bin/bash
# 设置环境变量文件

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "设置环境变量"
echo "=========================================="
echo ""

# 检查 .env 文件是否存在
if [ -f ".env" ]; then
    echo "⚠️  .env 文件已存在"
    read -p "是否覆盖？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消操作"
        exit 0
    fi
fi

# 从 .env.example 复制
if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✅ 已从 .env.example 创建 .env 文件"
else
    echo "❌ 错误: .env.example 文件不存在"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 环境变量文件已创建"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 编辑 .env 文件，填入实际的 API Key"
echo "  2. 运行: nano .env 或 vim .env"
echo ""
echo "提示："
echo "  - GOOGLE_API_KEY: 从 https://makersuite.google.com/app/apikey 获取"
echo "  - OPENAI_API_KEY: 从 https://platform.openai.com/api-keys 获取"
echo ""

