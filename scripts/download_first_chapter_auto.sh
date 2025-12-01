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

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "⚠️  虚拟环境不存在，正在创建..."
    ./scripts/setup_python_env.sh
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 检查是否安装了 playwright
if ! python3 -c "import playwright" 2>/dev/null; then
    echo "❌ 错误: 未安装 playwright"
    echo ""
    echo "正在安装依赖..."
    pip install -r scripts/requirements.txt
    playwright install chromium
fi

# 运行下载脚本
python scripts/download_with_playwright.py \
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
    echo "  1. 验证文件: python scripts/verify_file.py data/raw/shiji/shiji_01_gaozu_benji.txt"
    echo "  2. 预处理: python scripts/preprocess_text.py --input data/raw/shiji/shiji_01_gaozu_benji.txt --output data/processed/chapters/shiji_01_gaozu_benji.json --book '史记' --chapter '高祖本纪' --url 'https://zh.wikisource.org/wiki/史記/卷008'"
    echo ""
else
    echo ""
    echo "=========================================="
    echo "❌ 下载失败，请检查错误信息"
    echo "=========================================="
    exit 1
fi

