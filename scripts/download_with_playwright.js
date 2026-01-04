#!/usr/bin/env node
/**
 * 使用 Playwright 自动下载维基文库文本
 * 自动从维基文库下载历史书籍文本并保存为文件
 *
 * 使用方法:
 *    node scripts/download_with_playwright.js --url "https://zh.wikisource.org/wiki/史記/卷008" --output data/raw/shiji/shiji_01_gaozu_benji.txt
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * 从维基文库下载文本
 *
 * @param {string} url - 维基文库页面 URL
 * @param {string} outputPath - 输出文件路径
 * @param {string} [book] - 书籍名称（可选）
 * @param {string} [chapter] - 章节名称（可选）
 * @returns {Promise<boolean>} 是否成功
 */
async function downloadFromWikisource(url, outputPath, book = null, chapter = null) {
  const outputFile = path.resolve(outputPath);
  const outputDir = path.dirname(outputFile);

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`正在访问: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 访问页面
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 等待内容加载
    await page.waitForSelector('#mw-content-text', { timeout: 10000 });

    // 提取页面标题
    const pageTitle = await page.title();
    console.log(`页面标题: ${pageTitle}`);

    // 检查内容区域是否存在
    const contentElement = await page.$('#mw-content-text');
    if (!contentElement) {
      console.log('❌ 错误: 无法找到内容区域');
      await browser.close();
      return false;
    }

    // 移除不需要的元素（导航、编辑链接、目录等）
    await page.evaluate(() => {
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
        '.infobox',
      ];
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => el.remove());
      });
    });

    // 等待一下确保 DOM 更新
    await page.waitForTimeout(500);

    // 获取纯文本内容
    // 使用更精确的选择器获取正文内容
    let textContent = await page.evaluate(() => {
      const content = document.querySelector('#mw-content-text');
      if (!content) return '';

      // 获取所有段落
      const paragraphs = [];
      const elements = content.querySelectorAll('p, div.mw-parser-output > p, h2, h3');

      elements.forEach((el) => {
        const text = el.innerText.trim();
        if (text && text.length > 10) {
          // 过滤太短的内容
          paragraphs.push(text);
        }
      });

      return paragraphs.join('\n\n');
    });

    if (!textContent) {
      // 如果上面的方法失败，使用备用方法
      textContent = await contentElement.innerText();
    }

    // 清理文本
    // 文本已经是段落格式（用 \n\n 分隔）
    let paragraphs = textContent
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p);

    // 过滤掉导航、目录等不需要的内容
    const skipPatterns = [
      /^目录$/,
      /^跳至/,
      /^导航/,
      /^编辑/,
      /^查看历史/,
      /^维基文库/,
      /^参考文献/,
      /^外部链接/,
      /^参见/,
    ];

    const filteredParagraphs = [];
    let inContent = false;

    for (const para of paragraphs) {
      // 检查是否是内容开始
      if (!inContent) {
        // 检查是否包含章节关键词
        const keywords = ['本纪', '世家', '列传', '书', '表', '卷'];
        if (keywords.some((keyword) => para.includes(keyword))) {
          inContent = true;
        } else if (para.length > 20 && !skipPatterns.some((pattern) => pattern.test(para))) {
          inContent = true;
        }
      }

      if (!inContent) {
        continue;
      }

      // 跳过不需要的段落
      if (skipPatterns.some((pattern) => pattern.test(para))) {
        continue;
      }

      // 跳过很短的段落（可能是导航）
      if (para.length < 10) {
        continue;
      }

      filteredParagraphs.push(para);
    }

    paragraphs = filteredParagraphs;

    // 构建输出内容
    const outputLines = [];

    // 添加来源信息
    const source = book && chapter ? `《${book}·${chapter}》` : pageTitle;
    outputLines.push(`来源：${source}`);
    outputLines.push('获取渠道：维基文库');
    outputLines.push(`URL：${url}`);
    outputLines.push(`获取日期：${new Date().toISOString().split('T')[0]}`);
    outputLines.push('版权状态：公共领域（Public Domain）');
    outputLines.push('');
    outputLines.push('---');
    outputLines.push('');

    // 添加章节标题（从页面标题提取）
    if (chapter) {
      outputLines.push(`# ${chapter}`);
      outputLines.push('');
    } else if (book) {
      // 尝试从页面标题提取章节名
      const titleMatch = pageTitle.match(/[·：](.+)$/);
      if (titleMatch) {
        outputLines.push(`# ${titleMatch[1]}`);
        outputLines.push('');
      }
    }

    // 添加段落内容
    for (const para of paragraphs) {
      if (para.trim()) {
        outputLines.push(para);
        outputLines.push(''); // 段落之间空行
      }
    }

    // 保存文件
    await fs.writeFile(outputFile, outputLines.join('\n'), 'utf-8');

    const stats = await fs.stat(outputFile);
    console.log('✅ 下载完成！');
    console.log(`   文件路径: ${outputFile}`);
    console.log(`   段落数: ${paragraphs.length}`);
    console.log(`   文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    await browser.close();
    return true;
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
    await browser.close();
    return false;
  }
}

async function main() {
  program
    .name('download_with_playwright')
    .description('使用 Playwright 自动下载维基文库文本')
    .requiredOption('-u, --url <url>', '维基文库页面 URL')
    .requiredOption('-o, --output <path>', '输出文件路径')
    .option('-b, --book <name>', '书籍名称（如：史记）')
    .option('-c, --chapter <name>', '章节名称（如：高祖本纪）')
    .parse(process.argv);

  const options = program.opts();

  const success = await downloadFromWikisource(
    options.url,
    options.output,
    options.book,
    options.chapter,
  );

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 未处理的错误:', error);
    process.exit(1);
  });
}

module.exports = { downloadFromWikisource };

