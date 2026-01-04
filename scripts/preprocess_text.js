#!/usr/bin/env node
/**
 * 文本预处理脚本
 * 用于将原始文本文件处理成标准格式，添加段落编号等
 *
 * 使用方法:
 *    node scripts/preprocess_text.js --input data/raw/shiji/chapter.txt --output data/processed/chapters/chapter.json
 */

const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

/**
 * 预处理文本文件
 *
 * @param {string} inputFile - 输入文本文件路径
 * @param {string} outputFile - 输出 JSON 文件路径
 * @param {Object} [sourceInfo] - 来源信息字典（可选）
 * @returns {Promise<void>}
 */
async function preprocessText(inputFile, outputFile, sourceInfo = null) {
  // 读取原始文本
  const content = await fs.readFile(inputFile, 'utf-8');

  // 提取章节标题（如果存在）
  const titleMatch = content.match(/^#+\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1] : path.basename(inputFile, path.extname(inputFile));

  // 跳过文件开头的元数据部分（直到 "---" 分隔线）
  const lines = content.split('\n');
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      startIndex = i + 1;
      break;
    }
  }

  // 从分隔线后开始处理
  const contentLines = lines.slice(startIndex);

  // 按段落分割（空行分隔）
  const paragraphs = [];
  let currentParagraph = [];

  for (const line of contentLines) {
    const trimmedLine = line.trim();

    // 跳过空行和标题行（Markdown 格式）
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join('\n'));
        currentParagraph = [];
      }
      continue;
    }

    // 跳过元数据行
    const metadataPrefixes = ['来源：', '获取渠道：', '获取日期：', 'URL：', '版权状态：'];
    if (metadataPrefixes.some((prefix) => trimmedLine.startsWith(prefix))) {
      continue;
    }

    // 跳过分隔线
    if (trimmedLine === '---') {
      continue;
    }

    currentParagraph.push(line);
  }

  // 添加最后一个段落
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join('\n'));
  }

  // 过滤空段落和太短的段落（可能是残留的元数据）
  const filteredParagraphs = paragraphs.filter(
    (p) => p.trim() && p.trim().length > 10,
  );

  // 构建输出数据
  const outputData = {
    title,
    source: sourceInfo || {
      book: 'unknown',
      chapter: 'unknown',
      url: '',
      date: new Date().toISOString(),
    },
    paragraphs: filteredParagraphs.map((p, i) => ({
      order: i + 1,
      text: p,
      id: `para_${i + 1}`,
    })),
    processedAt: new Date().toISOString(),
    totalParagraphs: filteredParagraphs.length,
  };

  // 保存为 JSON
  const outputPath = path.resolve(outputFile);
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(
    outputPath,
    JSON.stringify(outputData, null, 2),
    'utf-8',
  );

  console.log(`✅ 处理完成：${filteredParagraphs.length} 个段落`);
  console.log(`   输出文件：${outputFile}`);
}

async function main() {
  program
    .name('preprocess_text')
    .description('文本预处理脚本')
    .requiredOption('-i, --input <path>', '输入文本文件路径')
    .requiredOption('-o, --output <path>', '输出 JSON 文件路径')
    .option('-b, --book <name>', '书籍名称（如：史记）')
    .option('-c, --chapter <name>', '章节名称（如：高祖本纪）')
    .option('-u, --url <url>', '来源 URL')
    .parse(process.argv);

  const options = program.opts();

  // 构建来源信息
  const sourceInfo = {};
  if (options.book) {
    sourceInfo.book = options.book;
  }
  if (options.chapter) {
    sourceInfo.chapter = options.chapter;
  }
  if (options.url) {
    sourceInfo.url = options.url;
  }

  await preprocessText(
    options.input,
    options.output,
    Object.keys(sourceInfo).length > 0 ? sourceInfo : null,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  });
}

module.exports = { preprocessText };

