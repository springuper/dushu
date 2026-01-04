#!/bin/bash
# 自动下载第一个章节（使用 Playwright）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "自动下载《史记·高祖本纪》"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

# 检查 Node.js 依赖
if [ ! -d "node_modules" ] || [ ! -d "node_modules/playwright" ]; then
    echo "⚠️  未检测到 Playwright，正在安装依赖..."
    npm install
    npx playwright install chromium
fi

# 运行下载脚本
node scripts/download_with_playwright.js \
  --url "https://zh.wikisource.org/wiki/史記/卷008" \
  --output "data/raw/shiji/shiji_01_gaozu_benji.txt" \
  --book "史记" \
  --chapter "高祖本纪"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 下载成功！"
    echo "=========================================="
    echo ""
    echo "下一步："
    echo "  1. 检查文件: ls -lh data/raw/shiji/shiji_01_gaozu_benji.txt"
    echo "  2. 预处理: node scripts/preprocess_text.js --input data/raw/shiji/shiji_01_gaozu_benji.txt --output data/processed/chapters/shiji_01_gaozu_benji.json --book '史记' --chapter '高祖本纪' --url 'https://zh.wikisource.org/wiki/史記/卷008'"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "❌ 下载失败，请检查错误信息"
    echo "=========================================="
    exit 1
fi

