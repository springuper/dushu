#!/bin/bash
# 数据提取便捷脚本
# 自动提取人物、关系、地点、事件数据

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 检查参数
if [ $# -lt 1 ]; then
    echo "用法: $0 <输入文件> [类型]"
    echo ""
    echo "类型选项:"
    echo "  all        - 提取所有类型（人物、关系、地点、事件）"
    echo "  person     - 只提取人物"
    echo "  relationship - 只提取关系"
    echo "  place      - 只提取地点"
    echo "  event      - 只提取事件"
    echo ""
    echo "示例:"
    echo "  $0 data/raw/shiji/shiji_01_gaozu_benji.txt all"
    echo "  $0 data/raw/shiji/shiji_01_gaozu_benji.txt person"
    exit 1
fi

INPUT_FILE="$1"
TYPE="${2:-all}"

# 检查输入文件
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ 错误: 文件不存在: $INPUT_FILE"
    exit 1
fi

# 加载 .env 文件（如果存在）
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# 检查 API Key（支持 OpenAI 或 Gemini）
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
    echo "  # OpenAI"
    echo "  export OPENAI_API_KEY='your-api-key'"
    echo ""
    echo "  # Google Gemini"
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
    echo "❌ 错误: 虚拟环境不存在，请先创建: python3 -m venv venv && source venv/bin/activate && pip install -r scripts/requirements.txt"
    exit 1
fi

# 获取文件名（不含扩展名）用于输出
BASENAME=$(basename "$INPUT_FILE" .txt)
OUTPUT_DIR="$PROJECT_ROOT/data/extracted"

echo "=========================================="
echo "数据提取"
echo "=========================================="
echo "输入文件: $INPUT_FILE"
echo "提取类型: $TYPE"
echo ""

# 提取函数
extract_type() {
    local type=$1
    local output_file="$OUTPUT_DIR/$type/${BASENAME}_${type}.json"
    
    echo "正在提取 $type..."
    
    local cmd="python scripts/extract_with_llm.py --input \"$INPUT_FILE\" --type $type --output \"$output_file\""
    
    # 指定 API 提供商（如果设置了 GOOGLE_API_KEY 则使用 Gemini）
    if [ -n "$GOOGLE_API_KEY" ]; then
        cmd="$cmd --provider gemini"
    elif [ -n "$OPENAI_API_KEY" ]; then
        cmd="$cmd --provider openai"
    fi
    
    # 如果是关系类型，需要人物文件
    if [ "$type" = "relationship" ]; then
        local persons_file="$OUTPUT_DIR/persons/${BASENAME}_persons.json"
        if [ -f "$persons_file" ]; then
            cmd="$cmd --persons-file \"$persons_file\""
        fi
    fi
    
    eval $cmd
    
    if [ $? -eq 0 ]; then
        echo "✅ $type 提取完成: $output_file"
    else
        echo "❌ $type 提取失败"
        return 1
    fi
}

# 根据类型提取
case "$TYPE" in
    all)
        extract_type "person" || exit 1
        echo ""
        extract_type "relationship" || exit 1
        echo ""
        extract_type "place" || exit 1
        echo ""
        extract_type "event" || exit 1
        ;;
    person|relationship|place|event)
        extract_type "$TYPE"
        ;;
    *)
        echo "❌ 错误: 未知类型: $TYPE"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "✅ 提取完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 登录管理后台: http://localhost:5173/admin/login"
echo "  2. 进入'批量导入'页面"
echo "  3. 上传提取的 JSON 文件"
echo "  4. 在'Review'页面审核数据"
echo ""

