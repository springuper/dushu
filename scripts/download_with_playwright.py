#!/usr/bin/env python3
"""
使用 Playwright 自动下载维基文库文本
自动从维基文库下载历史书籍文本并保存为文件

使用方法:
    python scripts/download_with_playwright.py --url "https://zh.wikisource.org/wiki/史記/卷008" --output data/raw/shiji/shiji_01_gaozu_benji.txt
"""

import argparse
import re
from pathlib import Path
from datetime import datetime

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("错误: 请先安装 playwright: pip install playwright")
    print("然后运行: playwright install chromium")
    exit(1)


def download_from_wikisource(url: str, output_path: str, book: str = None, chapter: str = None):
    """
    从维基文库下载文本
    
    Args:
        url: 维基文库页面 URL
        output_path: 输出文件路径
        book: 书籍名称（可选）
        chapter: 章节名称（可选）
    """
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"正在访问: {url}")
    
    with sync_playwright() as p:
        # 启动浏览器（无头模式）
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # 访问页面
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # 等待内容加载
            page.wait_for_selector("#mw-content-text", timeout=10000)
            
            # 提取页面标题
            page_title = page.title()
            print(f"页面标题: {page_title}")
            
            # 提取主要内容区域
            # 维基文库的主要内容在 #mw-content-text 中
            content_element = page.query_selector("#mw-content-text")
            
            if not content_element:
                print("❌ 错误: 无法找到内容区域")
                browser.close()
                return False
            
            # 移除不需要的元素（导航、编辑链接、目录等）
            page.evaluate("""
                // 移除不需要的元素
                const selectors = [
                    '.mw-editsection',
                    '.mw-heading-number', 
                    '.toc',
                    '.navbox',
                    '.reference',
                    '.mw-jump-link',
                    '.mw-cite-backlink',
                    '.noprint',
                    '.mw-references-wrap',
                    'table.navbox',
                    '.infobox'
                ];
                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
            """)
            
            # 等待一下确保 DOM 更新
            page.wait_for_timeout(500)
            
            # 获取纯文本内容
            # 使用更精确的选择器获取正文内容
            text_content = page.evaluate("""
                () => {
                    const content = document.querySelector('#mw-content-text');
                    if (!content) return '';
                    
                    // 获取所有段落
                    const paragraphs = [];
                    const elements = content.querySelectorAll('p, div.mw-parser-output > p, h2, h3');
                    
                    elements.forEach(el => {
                        const text = el.innerText.trim();
                        if (text && text.length > 10) {  // 过滤太短的内容
                            paragraphs.push(text);
                        }
                    });
                    
                    return paragraphs.join('\\n\\n');
                }
            """)
            
            if not text_content:
                # 如果上面的方法失败，使用备用方法
                text_content = content_element.inner_text()
            
            # 清理文本
            # 文本已经是段落格式（用 \n\n 分隔）
            paragraphs = [p.strip() for p in text_content.split('\n\n') if p.strip()]
            
            # 过滤掉导航、目录等不需要的内容
            skip_patterns = [
                r'^目录$',
                r'^跳至',
                r'^导航',
                r'^编辑',
                r'^查看历史',
                r'^维基文库',
                r'^参考文献',
                r'^外部链接',
                r'^参见',
            ]
            
            filtered_paragraphs = []
            in_content = False
            
            for para in paragraphs:
                # 检查是否是内容开始
                if not in_content:
                    # 检查是否包含章节关键词
                    if any(keyword in para for keyword in ['本纪', '世家', '列传', '书', '表', '卷']):
                        in_content = True
                    elif len(para) > 20 and not any(re.match(pattern, para) for pattern in skip_patterns):
                        in_content = True
                
                if not in_content:
                    continue
                
                # 跳过不需要的段落
                if any(re.match(pattern, para) for pattern in skip_patterns):
                    continue
                
                # 跳过很短的段落（可能是导航）
                if len(para) < 10:
                    continue
                
                filtered_paragraphs.append(para)
            
            paragraphs = filtered_paragraphs
            
            # 构建输出内容
            output_lines = []
            
            # 添加来源信息
            output_lines.append("来源：" + (f"《{book}·{chapter}》" if book and chapter else page_title))
            output_lines.append("获取渠道：维基文库")
            output_lines.append(f"URL：{url}")
            output_lines.append(f"获取日期：{datetime.now().strftime('%Y-%m-%d')}")
            output_lines.append("版权状态：公共领域（Public Domain）")
            output_lines.append("")
            output_lines.append("---")
            output_lines.append("")
            
            # 添加章节标题（从页面标题提取）
            if chapter:
                output_lines.append(f"# {chapter}")
                output_lines.append("")
            elif book:
                # 尝试从页面标题提取章节名
                title_match = re.search(r'[·：](.+)$', page_title)
                if title_match:
                    output_lines.append(f"# {title_match.group(1)}")
                    output_lines.append("")
            
            # 添加段落内容
            for para in paragraphs:
                if para.strip():
                    output_lines.append(para)
                    output_lines.append("")  # 段落之间空行
            
            # 保存文件
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(output_lines))
            
            print(f"✅ 下载完成！")
            print(f"   文件路径: {output_file}")
            print(f"   段落数: {len(paragraphs)}")
            print(f"   文件大小: {output_file.stat().st_size / 1024:.2f} KB")
            
            browser.close()
            return True
            
        except Exception as e:
            print(f"❌ 错误: {e}")
            browser.close()
            return False


def main():
    parser = argparse.ArgumentParser(description='使用 Playwright 自动下载维基文库文本')
    parser.add_argument('--url', '-u', required=True, help='维基文库页面 URL')
    parser.add_argument('--output', '-o', required=True, help='输出文件路径')
    parser.add_argument('--book', help='书籍名称（如：史记）')
    parser.add_argument('--chapter', help='章节名称（如：高祖本纪）')
    
    args = parser.parse_args()
    
    success = download_from_wikisource(
        args.url,
        args.output,
        args.book,
        args.chapter
    )
    
    exit(0 if success else 1)


if __name__ == '__main__':
    main()

