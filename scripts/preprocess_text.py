#!/usr/bin/env python3
"""
文本预处理脚本
用于将原始文本文件处理成标准格式，添加段落编号等

使用方法:
    python scripts/preprocess_text.py --input data/raw/shiji/chapter.txt --output data/processed/chapters/chapter.json
"""

import argparse
import json
import re
from pathlib import Path
from datetime import datetime


def preprocess_text(input_file: str, output_file: str, source_info: dict = None):
    """
    预处理文本文件
    
    Args:
        input_file: 输入文本文件路径
        output_file: 输出 JSON 文件路径
        source_info: 来源信息字典（可选）
    """
    # 读取原始文本
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取章节标题（如果存在）
    title_match = re.search(r'^#+\s*(.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else Path(input_file).stem
    
    # 跳过文件开头的元数据部分（直到 "---" 分隔线）
    lines = content.split('\n')
    start_index = 0
    for i, line in enumerate(lines):
        if line.strip() == '---':
            start_index = i + 1
            break
    
    # 从分隔线后开始处理
    content_lines = lines[start_index:]
    
    # 按段落分割（空行分隔）
    paragraphs = []
    current_paragraph = []
    
    for line in content_lines:
        line = line.strip()
        
        # 跳过空行和标题行（Markdown 格式）
        if not line or line.startswith('#'):
            if current_paragraph:
                paragraphs.append('\n'.join(current_paragraph))
                current_paragraph = []
            continue
        
        # 跳过元数据行
        if any(line.startswith(prefix) for prefix in ['来源：', '获取渠道：', '获取日期：', 'URL：', '版权状态：']):
            continue
        
        # 跳过分隔线
        if line == '---':
            continue
        
        current_paragraph.append(line)
    
    # 添加最后一个段落
    if current_paragraph:
        paragraphs.append('\n'.join(current_paragraph))
    
    # 过滤空段落和太短的段落（可能是残留的元数据）
    paragraphs = [p for p in paragraphs if p.strip() and len(p.strip()) > 10]
    
    # 构建输出数据
    output_data = {
        'title': title,
        'source': source_info or {
            'book': 'unknown',
            'chapter': 'unknown',
            'url': '',
            'date': datetime.now().isoformat(),
        },
        'paragraphs': [
            {
                'order': i + 1,
                'text': p,
                'id': f"para_{i + 1}",
            }
            for i, p in enumerate(paragraphs)
        ],
        'processedAt': datetime.now().isoformat(),
        'totalParagraphs': len(paragraphs),
    }
    
    # 保存为 JSON
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 处理完成：{len(paragraphs)} 个段落")
    print(f"   输出文件：{output_file}")


def main():
    parser = argparse.ArgumentParser(description='文本预处理脚本')
    parser.add_argument('--input', '-i', required=True, help='输入文本文件路径')
    parser.add_argument('--output', '-o', required=True, help='输出 JSON 文件路径')
    parser.add_argument('--book', help='书籍名称（如：史记）')
    parser.add_argument('--chapter', help='章节名称（如：高祖本纪）')
    parser.add_argument('--url', help='来源 URL')
    
    args = parser.parse_args()
    
    # 构建来源信息
    source_info = {}
    if args.book:
        source_info['book'] = args.book
    if args.chapter:
        source_info['chapter'] = args.chapter
    if args.url:
        source_info['url'] = args.url
    
    preprocess_text(args.input, args.output, source_info if source_info else None)


if __name__ == '__main__':
    main()

