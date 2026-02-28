#!/bin/bash
# 下载 + 预处理 一键完成
# 从维基文库下载章节文本，自动预处理为 JSON，可直接在后台导入
#
# 使用示例:
#   ./scripts/download_and_prepare.sh --url "https://zh.wikisource.org/wiki/史記/卷008" --book "史记" --chapter "高祖本纪"
#   ./scripts/download_and_prepare.sh --url "https://zh.wikisource.org/wiki/史記/卷007" --book "史记" --chapter "项羽本纪"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 默认值
URL=""
BOOK=""
CHAPTER=""
OUTPUT_RAW=""
OUTPUT_JSON=""

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      URL="$2"
      shift 2
      ;;
    --book)
      BOOK="$2"
      shift 2
      ;;
    --chapter)
      CHAPTER="$2"
      shift 2
      ;;
    --output-raw)
      OUTPUT_RAW="$2"
      shift 2
      ;;
    --output-json)
      OUTPUT_JSON="$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

if [ -z "$URL" ] || [ -z "$BOOK" ] || [ -z "$CHAPTER" ]; then
  echo "用法: $0 --url <维基文库URL> --book <书籍名> --chapter <章节名>"
  echo ""
  echo "示例:"
  echo "  $0 --url 'https://zh.wikisource.org/wiki/史記/卷008' --book '史记' --chapter '高祖本纪'"
  exit 1
fi

# 生成文件名（书籍缩写_章节缩写_时间戳）
BOOK_SLUG=$(echo "$BOOK" | sed 's/[[:space:][:punct:]]/-/g' | head -c 15)
CHAPTER_SLUG=$(echo "$CHAPTER" | sed 's/[[:space:][:punct:]]/-/g' | head -c 20)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASE_NAME="${BOOK_SLUG}_${CHAPTER_SLUG}_${TIMESTAMP}"

# 默认输出路径
if [ -z "$OUTPUT_RAW" ]; then
  OUTPUT_RAW="data/raw/${BOOK_SLUG}/${BASE_NAME}.txt"
fi
if [ -z "$OUTPUT_JSON" ]; then
  OUTPUT_JSON="data/processed/chapters/${BASE_NAME}.json"
fi

echo "=========================================="
echo "下载 + 预处理：${BOOK} · ${CHAPTER}"
echo "=========================================="
echo ""

# 检查依赖
if [ ! -d "node_modules" ] || [ ! -d "node_modules/playwright" ]; then
  echo "⚠️  未检测到 Playwright，正在安装..."
  npm install
  npx playwright install chromium
fi

# Step 1: 下载
echo "📥 Step 1/2: 下载原始文本..."
node scripts/download_with_playwright.js \
  --url "$URL" \
  --output "$OUTPUT_RAW" \
  --book "$BOOK" \
  --chapter "$CHAPTER"

if [ $? -ne 0 ]; then
  echo "❌ 下载失败"
  exit 1
fi

# Step 2: 预处理
echo ""
echo "🔧 Step 2/2: 预处理为 JSON..."
node scripts/preprocess_text.js \
  --input "$OUTPUT_RAW" \
  --output "$OUTPUT_JSON" \
  --book "$BOOK" \
  --chapter "$CHAPTER" \
  --url "$URL"

if [ $? -ne 0 ]; then
  echo "❌ 预处理失败"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ 完成！"
echo "=========================================="
echo ""
echo "输出文件: $OUTPUT_JSON"
echo ""
echo "下一步："
echo "  1. 启动后台: cd backend && npm run dev"
echo "  2. 打开 内容管理 → 章节管理 → 导入章节"
echo "  3. 选择书籍，上传文件: $OUTPUT_JSON"
echo "  或直接上传原始文本: $OUTPUT_RAW"
echo ""
