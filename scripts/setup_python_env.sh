#!/bin/bash
# 设置 Python 虚拟环境并安装依赖

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "设置 Python 虚拟环境"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在"
    echo ""
    read -p "是否从 .env.example 创建 .env 文件？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo "✅ 已创建 .env 文件，请编辑并填入 API Key"
        else
            echo "❌ 错误: .env.example 文件不存在"
        fi
    fi
    echo ""
fi

# 检查是否已有虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
    echo "✅ 虚拟环境创建完成"
else
    echo "✅ 虚拟环境已存在"
fi

# 激活虚拟环境
echo ""
echo "激活虚拟环境..."
source venv/bin/activate

# 升级 pip
echo "升级 pip..."
pip install --upgrade pip

# 安装依赖
echo ""
echo "安装 Python 依赖..."
if [ -f "scripts/requirements.txt" ]; then
    pip install -r scripts/requirements.txt
else
    pip install playwright openai
fi

# 安装 Playwright 浏览器
echo ""
echo "安装 Playwright 浏览器驱动..."
playwright install chromium

echo ""
echo "=========================================="
echo "✅ 环境设置完成！"
echo "=========================================="
echo ""
echo "使用方法："
echo "  1. 激活虚拟环境: source venv/bin/activate"
echo "  2. 运行脚本: python scripts/download_with_playwright.py ..."
echo ""
echo "或者使用便捷脚本（会自动激活虚拟环境）："
echo "  ./scripts/download_first_chapter_auto.sh"
echo ""

