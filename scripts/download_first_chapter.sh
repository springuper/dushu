#!/bin/bash
# 下载第一个章节的辅助脚本
# 这个脚本会打开浏览器并显示下载指南

echo "=========================================="
echo "下载《史记·高祖本纪》指南"
echo "=========================================="
echo ""
echo "步骤 1: 打开浏览器访问以下链接："
echo "   https://zh.wikisource.org/wiki/史記/卷008"
echo ""
echo "步骤 2: 复制页面内容"
echo "   - 全选页面内容 (Cmd/Ctrl + A)"
echo "   - 复制 (Cmd/Ctrl + C)"
echo ""
echo "步骤 3: 创建文件并粘贴内容"
echo "   文件路径: data/raw/shiji/shiji_01_gaozu_benji.txt"
echo ""
echo "步骤 4: 检查文件格式"
echo "   - 确保文件是 UTF-8 编码"
echo "   - 确保文件开头包含来源信息（参考 EXAMPLE_FORMAT.txt）"
echo ""
echo "步骤 5: 验证文件"
echo "   - 检查文件大小（应该 > 10KB）"
echo "   - 检查段落格式（段落之间用空行分隔）"
echo ""
echo "=========================================="
echo "提示：可以参考 data/raw/shiji/EXAMPLE_FORMAT.txt 了解正确的格式"
echo "=========================================="

# 尝试打开浏览器（macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "正在打开浏览器..."
    open "https://zh.wikisource.org/wiki/史記/卷008"
fi

