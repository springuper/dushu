#!/usr/bin/env python3
"""
文件验证脚本
用于验证下载的文本文件是否符合要求

使用方法:
    python scripts/verify_file.py data/raw/shiji/shiji_01_gaozu_benji.txt
"""

import argparse
import sys
from pathlib import Path


def verify_file(file_path: str) -> bool:
    """
    验证文件是否符合要求
    
    Returns:
        bool: 是否符合要求
    """
    path = Path(file_path)
    
    if not path.exists():
        print(f"❌ 错误：文件不存在: {file_path}")
        return False
    
    # 检查文件大小
    size = path.stat().st_size
    if size < 1000:  # 小于 1KB
        print(f"⚠️  警告：文件太小 ({size} bytes)，可能不完整")
    elif size > 10 * 1024 * 1024:  # 大于 10MB
        print(f"⚠️  警告：文件太大 ({size / 1024 / 1024:.2f} MB)，可能包含多余内容")
    else:
        print(f"✅ 文件大小：{size / 1024:.2f} KB")
    
    # 尝试读取文件（检查编码）
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        print("❌ 错误：文件不是 UTF-8 编码")
        return False
    except Exception as e:
        print(f"❌ 错误：无法读取文件: {e}")
        return False
    
    print("✅ 文件编码：UTF-8")
    
    # 检查是否包含来源信息
    has_source = False
    if '来源：' in content or '来源:' in content:
        has_source = True
        print("✅ 包含来源信息")
    else:
        print("⚠️  警告：未找到来源信息，建议在文件开头添加")
    
    # 检查段落格式
    lines = content.split('\n')
    non_empty_lines = [l.strip() for l in lines if l.strip()]
    
    if len(non_empty_lines) < 10:
        print(f"⚠️  警告：内容行数较少 ({len(non_empty_lines)} 行)，可能不完整")
    else:
        print(f"✅ 内容行数：{len(non_empty_lines)} 行")
    
    # 检查是否包含章节标题
    has_title = False
    for line in lines[:20]:  # 检查前 20 行
        if any(keyword in line for keyword in ['本纪', '世家', '列传', '书', '表']):
            has_title = True
            break
    
    if has_title:
        print("✅ 包含章节标题")
    else:
        print("⚠️  警告：未找到明显的章节标题")
    
    # 检查段落分隔（空行）
    empty_lines = sum(1 for l in lines if not l.strip())
    if empty_lines < len(non_empty_lines) / 10:  # 空行应该至少是内容行的 10%
        print("⚠️  警告：段落之间可能缺少空行分隔")
    else:
        print("✅ 段落格式：正常")
    
    # 总结
    print("\n" + "=" * 50)
    if has_source and size > 1000:
        print("✅ 文件验证通过！可以继续处理")
        return True
    else:
        print("⚠️  文件验证有警告，建议检查后再处理")
        return False


def main():
    parser = argparse.ArgumentParser(description='验证文本文件')
    parser.add_argument('file', help='要验证的文件路径')
    
    args = parser.parse_args()
    
    success = verify_file(args.file)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

