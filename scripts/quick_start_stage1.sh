#!/bin/bash
# 阶段 1 快速开始脚本
# 从 1 个人物开始验证流程

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "阶段 1：验证流程（从 1 个人物开始）"
echo "=========================================="
echo ""

# 检查输入文件（默认使用已有的文件）
INPUT_FILE="${1:-data/raw/shiji/shiji_01_gaozu_benji.txt}"

if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ 错误: 文件不存在: $INPUT_FILE"
    echo ""
    echo "请提供输入文件路径，例如："
    echo "  $0 data/raw/shiji/shiji_01_gaozu_benji.txt"
    exit 1
fi

# 加载 .env 文件
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# 检查 API Key
if [ -z "$OPENAI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    echo "⚠️  警告: 未设置 API Key"
    echo ""
    echo "请设置以下任一 API Key:"
    echo ""
    echo "方法 1：使用 .env 文件（推荐）"
    echo "  1. 运行: ./scripts/setup_env.sh"
    echo "  2. 编辑 .env 文件，填入 API Key"
    echo ""
    echo "方法 2：设置环境变量"
    echo "  export OPENAI_API_KEY='your-api-key'"
    echo "  或"
    echo "  export GOOGLE_API_KEY='your-api-key'"
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 激活虚拟环境
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ 错误: 虚拟环境不存在，请先运行: ./scripts/setup_python_env.sh"
    exit 1
fi

# 获取文件名（不含扩展名）
BASENAME=$(basename "$INPUT_FILE" .txt)
OUTPUT_DIR="$PROJECT_ROOT/data/extracted"
OUTPUT_FILE="$OUTPUT_DIR/persons/${BASENAME}_test_persons.json"

# 确保输出目录存在
mkdir -p "$OUTPUT_DIR/persons"

echo "输入文件: $INPUT_FILE"
echo "输出文件: $OUTPUT_FILE"
echo ""

# 提取人物数据
echo "正在提取人物数据..."
echo ""

CMD="python scripts/extract_with_llm.py --input \"$INPUT_FILE\" --type person --output \"$OUTPUT_FILE\""

# 指定 API 提供商
if [ -n "$GOOGLE_API_KEY" ]; then
    CMD="$CMD --provider gemini"
elif [ -n "$OPENAI_API_KEY" ]; then
    CMD="$CMD --provider openai"
fi

eval $CMD

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 提取完成！"
    echo ""
    echo "=========================================="
    echo "下一步操作："
    echo "=========================================="
    echo ""
    echo "1. 查看提取结果："
    echo "   cat $OUTPUT_FILE | python -m json.tool | head -n 50"
    echo ""
    echo "2. 导入到管理后台："
    echo "   - 访问: http://localhost:5173/admin/login"
    echo "   - 进入'批量导入'页面"
    echo "   - 选择文件: $OUTPUT_FILE"
    echo "   - 选择类型: 人物"
    echo "   - 点击'开始导入'"
    echo ""
    echo "3. 审核数据："
    echo "   - 进入'Review'页面"
    echo "   - 查看待审核的人物"
    echo "   - 审核并通过"
    echo ""
    echo "4. 验证数据："
    echo "   - 进入'内容管理' → '人物管理'"
    echo "   - 查看已审核的人物"
    echo ""
    echo "详细指南请查看: scripts/INCREMENTAL_WORKFLOW.md"
    echo ""
else
    echo ""
    echo "❌ 提取失败，请检查错误信息"
    exit 1
fi

