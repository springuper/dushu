/**
 * 章节文本预处理
 * 将原始文本转换为结构化 JSON（与 scripts/preprocess_text.js 逻辑一致）
 */

export interface PreprocessedParagraph {
  order: number
  text: string
  id: string
}

export interface PreprocessedChapter {
  title: string
  source: {
    book: string
    chapter: string
    url: string
    date: string
  }
  paragraphs: PreprocessedParagraph[]
  totalParagraphs: number
}

export interface PreprocessOptions {
  title?: string
  book?: string
  chapter?: string
  url?: string
}

/**
 * 预处理原始文本为章节结构
 */
export function preprocessRawText(
  content: string,
  options: PreprocessOptions = {}
): PreprocessedChapter {
  // 提取章节标题（如果存在 Markdown 格式）
  const titleMatch = content.match(/^#+\s*(.+)$/m)
  const defaultTitle = options.chapter || options.title || '未命名章节'
  const title = titleMatch ? titleMatch[1].trim() : defaultTitle

  // 跳过 --- 前的元数据
  const lines = content.split('\n')
  let startIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      startIndex = i + 1
      break
    }
  }
  const contentLines = lines.slice(startIndex)

  // 按空行分段落
  const paragraphs: string[] = []
  let currentParagraph: string[] = []

  const metadataPrefixes = ['来源：', '获取渠道：', '获取日期：', 'URL：', '版权状态：']
  const skipPatterns = [/^目录$/, /^跳至/, /^导航/, /^编辑/, /^查看历史/, /^维基文库/, /^参考文献/, /^外部链接/, /^参见/]

  for (const line of contentLines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join('\n'))
        currentParagraph = []
      }
      continue
    }
    if (metadataPrefixes.some((p) => trimmedLine.startsWith(p))) continue
    if (trimmedLine === '---') continue
    if (skipPatterns.some((p) => p.test(trimmedLine))) continue

    currentParagraph.push(line)
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join('\n'))
  }

  // 过滤空段落和过短段落
  const filteredParagraphs = paragraphs.filter((p) => p.trim().length > 10)

  return {
    title,
    source: {
      book: options.book || 'unknown',
      chapter: options.chapter || 'unknown',
      url: options.url || '',
      date: new Date().toISOString(),
    },
    paragraphs: filteredParagraphs.map((p, i) => ({
      order: i + 1,
      text: p.trim(),
      id: `para_${i + 1}`,
    })),
    totalParagraphs: filteredParagraphs.length,
  }
}
