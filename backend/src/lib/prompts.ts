/**
 * LLM 提示词构建函数
 * 用于构建各种提取任务的提示词
 */

import { ExtractedPlace } from './llmExtractor'

// ============================================
// 事件提取提示词
// ============================================

/**
 * 第一阶段：构建事件概览提取提示词
 * 用于快速提取所有事件的基本信息（名称、时间、重要程度）
 */
export function buildEventOverviewPrompt(
  text: string,
  paragraphs?: { id: string; text: string }[]
): string {
  let processedText = text
  if (paragraphs && paragraphs.length > 0) {
    processedText = paragraphs.map((p) => `[${p.id}] ${p.text.trim()}`).join('\n\n')
  }

  const formatNote =
    paragraphs && paragraphs.length > 0
      ? `\n\n**格式说明**：每段文本前标注了段落ID（格式为 \`[段落ID]\`），请在提取事件时，将事件关联到相关的段落ID（在 \`relatedParagraphs\` 字段中使用对应的段落ID）。\n\n`
      : '\n\n'

  return `你是历史事件提取专家。请从以下文本中提取所有重要历史事件的概览信息。

## 输出格式（JSON）

{
  "eventOverviews": [
    {
      "name": "事件名称",
      "timeRangeStart": "开始时间，必须使用公元纪年格式：
        - 公元前：使用'-XX年'或'-XX-月'格式，如'-206年'、'-206-12'（表示公元前206年12月）
        - 公元后：使用'XX年'或'XX-月'格式，如'25年'、'25-12'
        - 不确定的年份：'约-206年'或'约25年'
        
        **重要：朝代纪年转换规则（以十月为岁首的朝代）**
        
        1. **秦朝（公元前221-前207年）和汉朝初期（公元前206-前104年）**：
           这两个朝代都以十月为岁首（一年的开始是十月），转换时需注意：
           - X年十月、十一月、十二月 = 该年号对应公元年份的10月、11月、12月
           - X年一月到九月 = 该年号对应公元年份+1年的1月到9月
           
           关键年号对应：
           - 秦始皇元年 = 公元前221年
           - 秦二世元年 = 公元前209年
           - 汉元年 = 公元前206年（刘邦称汉王）
           
           示例：
           - 秦始皇二十六年十月 = 公元前221年10月
           - 秦始皇二十六年一月 = 公元前220年1月
           - 秦二世元年十月 = 公元前209年10月
           - 秦二世元年一月 = 公元前208年1月
           - 汉元年十月 = 公元前206年10月
           - 汉元年一月 = 公元前205年1月
           - 汉十二年四月 = 公元前195年4月
           - 汉十二年十月 = 公元前196年10月
        
        2. **汉武帝太初元年（公元前104年）之后**：
           岁首改为正月，月份直接对应，无需特殊转换。
        
        3. **其他朝代**：直接查找该年号对应的公元年份，月份直接对应。
        
        4. **不要使用朝代年号格式**：必须转换为公元纪年，不要使用'汉元年'、'秦二世元年'等格式",
      "timeRangeEnd": "结束时间（可选），格式同上",
      "importance": "L1|L2|L3|L4|L5",
      "relatedParagraphs": ["段落ID1", "段落ID2"]
    }
  ]
}

## 重要程度分级标准

**L1（最高优先级，必须包含）**：
- 改朝换代（如刘邦即皇帝位）
- 决定性重大战役（如垓下之战）
- **主角/核心人物的生死**（如刘邦崩、项羽死）
- 影响历史进程的关键决策（如怀王约先入关中者王之）

**L2（高优先级）**：
- 重要政治事件（如项羽分封十八路诸侯）
- 重大军事行动（如刘邦入咸阳）
- 影响地区或国家局势的事件（如彭城之战）

**L3（中优先级）**：
- 重要人物生死（非主角，如范增之死）
- 关键转折点（如鸿门宴）
- 影响主要人物命运的事件（如韩信请封假齐王）

**L4（低优先级，可选）**：
- 一般战役、次要政治事件、局部冲突

**L5（最低优先级，不提取）**：
- 个人琐事、日常事务、无关紧要的事件

## 提取要求

1. **简体中文**：事件名称必须使用简体中文。若原文为繁体，请转换为简体后再输出（避免如「鴻門」应输出「鸿门」）
2. **提取所有级别1-3的事件**，忽略级别4-5
3. **必须包含所有L1事件**，即使数量较多
4. **准确评估重要程度**：
   - 主角/核心人物的生死**必须**标记为L1
   - 改朝换代**必须**标记为L1
   - 决定性战役**必须**标记为L1或L2
5. **按时间顺序排列**（timeRangeStart）
6. **关联段落ID**，便于后续定位
7. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹，不要任何前后缀或说明文字

## 待处理文本${formatNote}${processedText}`
}

/**
 * 第二阶段：构建事件详情提取提示词
 * 根据事件概览列表，提取指定范围内事件的详细信息
 */
export function buildEventDetailsPrompt(
  eventOverviews: Array<{ name: string; timeRangeStart: string; importance: string; relatedParagraphs?: string[] }>,
  text: string,
  paragraphs?: { id: string; text: string }[],
  options?: {
    offset?: number
    limit?: number
  }
): string {
  let processedText = text
  if (paragraphs && paragraphs.length > 0) {
    processedText = paragraphs.map((p) => `[${p.id}] ${p.text.trim()}`).join('\n\n')
  }

  const relatedParagraphsField =
    paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["段落ID1", "段落ID2"],  // 该事件出现在哪些段落中`
      : ''

  const relatedParagraphsExample =
    paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["para-15", "para-16"],`
      : ''

  const relatedParagraphsRequirement =
    paragraphs && paragraphs.length > 0
      ? `
8. **段落关联**：将每个事件关联到它出现的段落ID（relatedParagraphs字段），这对于阅读时的定位非常重要`
      : ''

  const formatNote =
    paragraphs && paragraphs.length > 0
      ? `\n\n**格式说明**：每段文本前标注了段落ID（格式为 \`[段落ID]\`），请在提取事件时，将事件关联到相关的段落ID（在 \`relatedParagraphs\` 字段中使用对应的段落ID）。\n\n`
      : '\n\n'

  // pageOverviews 已经是当前页的切片，所以应该返回所有事件的详细信息
  const eventCount = eventOverviews.length
  const startIndex = 1
  const endIndex = eventCount

  return `你是历史事件提取专家。请根据已有的事件概览列表，返回所有事件的详细信息。

## 已有的事件概览列表（按时间顺序，共 ${eventCount} 个事件）

${eventOverviews.map((e, idx) => {
  const paraInfo = e.relatedParagraphs && e.relatedParagraphs.length > 0 
    ? ` [段落: ${e.relatedParagraphs.join(', ')}]` 
    : ''
  return `${idx + 1}. ${e.name} (${e.timeRangeStart}, ${e.importance})${paraInfo}`
}).join('\n')}

## 输出格式（JSON）

{
  "eventDetails": [
    // 返回列表中所有 ${eventCount} 个事件的详细信息（第 ${startIndex} 到第 ${endIndex} 个）
    {
      "name": "事件名称",
      "type": "BATTLE|POLITICAL|PERSONAL|OTHER",
      "timeRangeStart": "开始时间，必须使用公元纪年格式：
        - 公元前：使用'-XX年'或'-XX-月'格式，如'-206年'、'-206-12'（表示公元前206年12月）
        - 公元后：使用'XX年'或'XX-月'格式，如'25年'、'25-12'
        - 不确定的年份：'约-206年'或'约25年'
        
        **重要：朝代纪年转换规则（以十月为岁首的朝代）**
        
        1. **秦朝（公元前221-前207年）和汉朝初期（公元前206-前104年）**：
           这两个朝代都以十月为岁首（一年的开始是十月），转换时需注意：
           - X年十月、十一月、十二月 = 该年号对应公元年份的10月、11月、12月
           - X年一月到九月 = 该年号对应公元年份+1年的1月到9月
           
           关键年号对应：
           - 秦始皇元年 = 公元前221年
           - 秦二世元年 = 公元前209年
           - 汉元年 = 公元前206年（刘邦称汉王）
           
           示例：
           - 秦始皇二十六年十月 = 公元前221年10月
           - 秦始皇二十六年一月 = 公元前220年1月
           - 秦二世元年十月 = 公元前209年10月
           - 秦二世元年一月 = 公元前208年1月
           - 汉元年十月 = 公元前206年10月
           - 汉元年一月 = 公元前205年1月
           - 汉十二年四月 = 公元前195年4月
           - 汉十二年十月 = 公元前196年10月
        
        2. **汉武帝太初元年（公元前104年）之后**：
           岁首改为正月，月份直接对应，无需特殊转换。
        
        3. **其他朝代**：直接查找该年号对应的公元年份，月份直接对应。
        
        4. **不要使用朝代年号格式**：必须转换为公元纪年，不要使用'汉元年'、'秦二世元年'等格式",
      "timeRangeEnd": "结束时间（可选），格式同上，如持续多年的战争",
      "timePrecision": "EXACT_DATE|MONTH|SEASON|YEAR|DECADE|APPROXIMATE",
      "locationName": "历史地名，格式要求：
        - 单一地名：直接写地名，如'鸿门'
        - 有别名或区域说明：使用'主地名 (别名/区域)'格式，如'鸿门 (戏)'表示鸿门是主地名，戏是别名或区域
        - 多个地点：用逗号分隔，如'鸿门, 彭城'
        - 括号内的内容将作为别名存储，用于关联Place数据表",
      "locationModernName": "现代地名（如知道）",
      "summary": "事件摘要（200-400字，要点式）",
      "impact": "历史影响（100-200字，可选）",
      "importance": "L1|L2|L3|L4|L5",
      ${relatedParagraphsField}
      "actors": [
        {
          "name": "人物姓名",
          "roleType": "PROTAGONIST|ALLY|OPPOSING|ADVISOR|EXECUTOR|OBSERVER|OTHER",
          "description": "此人在事件中的具体表现（50-100字）"
        }
      ]
      // **注意**：actors 数组最多包含5个最重要的参与者，按重要性排序。如果参与者超过5个，只选择最重要的5个。
    }
  ]
}

## 要求

1. **简体中文**：事件名称、人物姓名（actors.name）、地名（locationName）必须使用简体中文。若原文为繁体（如「田橫」「鴻門」），请转换为简体（「田横」「鸿门」）后再输出
2. **返回所有事件的详细信息**：必须返回列表中所有 ${eventCount} 个事件（第 ${startIndex} 到第 ${endIndex} 个）的完整信息
3. **保持 importance 字段**：必须与概览列表中的重要程度一致
4. **按时间顺序**：确保事件按 timeRangeStart 排序
5. **完整性**：每个事件的详细信息必须完整，包括所有必需字段
6. **参与者命名**：actors.name 应使用人物的**本名**（如"刘邦"而非"高祖"或"沛公"），且必须为简体
7. **参与者数量限制**：每个事件最多包含5个最重要的参与者，按重要性排序
8. **摘要质量**：确保摘要完整叙述事件经过，不遗漏关键细节
9. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹${relatedParagraphsRequirement}
10. **严格停止要求**：输出完整的 JSON 对象后，必须以 \`}\` 结尾并立即停止。禁止在 JSON 之后添加任何内容，包括但不限于：
   - 额外的代码块标记（如 \`\`\` 或 \`\`\`json）
   - 解释性文字
   - 说明性内容
   - 任何其他文本

## 待处理文本${formatNote}${processedText}

请返回列表中所有 ${eventCount} 个事件的详细信息。

**重要提醒**：输出完成后立即停止。JSON 对象以 \`}\` 结尾后，不要添加任何内容。`
}

/**
 * 构建事件提取提示词（支持分页模式）
 * @deprecated 使用 buildEventOverviewPrompt 和 buildEventDetailsPrompt 代替
 */
export function buildEventPrompt(
  text: string,
  paragraphs?: { id: string; text: string }[],
  options?: {
    eventNames?: string[]  // 已有的事件名称列表（用于后续分页请求）
    offset?: number        // 当前偏移量
    limit?: number         // 每页数量
  }
): string {
  // 如果有段落信息，将段落ID嵌入到文本中
  let processedText = text
  if (paragraphs && paragraphs.length > 0) {
    // 直接使用 paragraphs 重建文本，每个段落前添加ID
    processedText = paragraphs.map((p) => `[${p.id}] ${p.text.trim()}`).join('\n\n')
  }

  const relatedParagraphsField =
    paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["段落ID1", "段落ID2"],  // 该事件出现在哪些段落中`
      : ''

  const relatedParagraphsExample =
    paragraphs && paragraphs.length > 0
      ? `"relatedParagraphs": ["para-15", "para-16"],`
      : ''

  const relatedParagraphsRequirement =
    paragraphs && paragraphs.length > 0
      ? `
8. **段落关联**：将每个事件关联到它出现的段落ID（relatedParagraphs字段），这对于阅读时的定位非常重要`
      : ''

  const formatNote =
    paragraphs && paragraphs.length > 0
      ? `\n\n**格式说明**：每段文本前标注了段落ID（格式为 \`[段落ID]\`），请在提取事件时，将事件关联到相关的段落ID（在 \`relatedParagraphs\` 字段中使用对应的段落ID）。\n\n`
      : '\n\n'

  const isPaginationRequest = options?.eventNames && options.eventNames.length > 0
  const offset = options?.offset || 0
  const limit = options?.limit || 25

  // 如果是分页请求，使用不同的输出格式
  if (isPaginationRequest && options.eventNames) {
    const eventNames = options.eventNames
    const startIndex = offset + 1
    const endIndex = Math.min(offset + limit, eventNames.length)
    
    return `你是历史事件提取专家。请根据已有的事件名称列表，返回指定范围内事件的详细信息。

## 已有的事件名称列表（按时间顺序）

${eventNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

## 输出格式（JSON）

{
  "eventNames": ${JSON.stringify(eventNames)},  // 完整的事件名称列表（保持不变）
  "eventDetails": [
    // 只返回第 ${startIndex} 到第 ${endIndex} 个事件的详细信息
    {
      "name": "事件名称",
      "type": "BATTLE|POLITICAL|PERSONAL|OTHER",
      "timeRangeStart": "开始时间，必须使用公元纪年格式：
        - 公元前：使用'-XX年'或'-XX-月'格式，如'-206年'、'-206-12'（表示公元前206年12月）
        - 公元后：使用'XX年'或'XX-月'格式，如'25年'、'25-12'
        - 不确定的年份：'约-206年'或'约25年'
        
        **重要：朝代纪年转换规则（以十月为岁首的朝代）**
        
        1. **秦朝（公元前221-前207年）和汉朝初期（公元前206-前104年）**：
           这两个朝代都以十月为岁首（一年的开始是十月），转换时需注意：
           - X年十月、十一月、十二月 = 该年号对应公元年份的10月、11月、12月
           - X年一月到九月 = 该年号对应公元年份+1年的1月到9月
           
           关键年号对应：
           - 秦始皇元年 = 公元前221年
           - 秦二世元年 = 公元前209年
           - 汉元年 = 公元前206年（刘邦称汉王）
           
           示例：
           - 秦始皇二十六年十月 = 公元前221年10月
           - 秦始皇二十六年一月 = 公元前220年1月
           - 秦二世元年十月 = 公元前209年10月
           - 秦二世元年一月 = 公元前208年1月
           - 汉元年十月 = 公元前206年10月
           - 汉元年一月 = 公元前205年1月
           - 汉十二年四月 = 公元前195年4月
           - 汉十二年十月 = 公元前196年10月
        
        2. **汉武帝太初元年（公元前104年）之后**：
           岁首改为正月，月份直接对应，无需特殊转换。
        
        3. **其他朝代**：直接查找该年号对应的公元年份，月份直接对应。
        
        4. **不要使用朝代年号格式**：必须转换为公元纪年，不要使用'汉元年'、'秦二世元年'等格式",
      "timeRangeEnd": "结束时间（可选），格式同上，如持续多年的战争",
      "timePrecision": "EXACT_DATE|MONTH|SEASON|YEAR|DECADE|APPROXIMATE",
      "locationName": "历史地名，格式要求：
        - 单一地名：直接写地名，如'鸿门'
        - 有别名或区域说明：使用'主地名 (别名/区域)'格式，如'鸿门 (戏)'表示鸿门是主地名，戏是别名或区域
        - 多个地点：用逗号分隔，如'鸿门, 彭城'
        - 括号内的内容将作为别名存储，用于关联Place数据表",
      "locationModernName": "现代地名（如知道）",
      "summary": "事件摘要（200-400字，要点式）",
      "impact": "历史影响（100-200字，可选）",
      ${relatedParagraphsField}
      "actors": [
        {
          "name": "人物姓名",
          "roleType": "PROTAGONIST|ALLY|OPPOSING|ADVISOR|EXECUTOR|OBSERVER|OTHER",
          "description": "此人在事件中的具体表现（50-100字）"
        }
      ]
      // **注意**：actors 数组最多包含5个最重要的参与者，按重要性排序。如果参与者超过5个，只选择最重要的5个。
    }
  ],
  "offset": ${offset},
  "limit": ${limit}
}

## 要求

1. **只返回指定范围的事件详情**：仅返回第 ${startIndex} 到第 ${endIndex} 个事件的完整信息
2. **保持 eventNames 不变**：eventNames 字段必须与输入完全一致（最多50个事件）
3. **按时间顺序**：确保事件按 timeRangeStart 排序
4. **完整性**：每个事件的详细信息必须完整，包括所有必需字段
5. **参与者命名**：actors.name 应使用人物的**本名**（如"刘邦"而非"高祖"或"沛公"）
6. **参与者数量限制**：每个事件最多包含5个最重要的参与者，按重要性排序。如果参与者超过5个，只选择最重要的5个
7. **摘要质量**：确保摘要完整叙述事件经过，不遗漏关键细节
8. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹${relatedParagraphsRequirement}

## 待处理文本${formatNote}${processedText}

请返回第 ${startIndex} 到第 ${endIndex} 个事件的详细信息。`
  }

  // 首次请求：返回所有事件名称 + 前 limit 个事件的详情
  const importantReminder =
    paragraphs && paragraphs.length > 0
      ? `

## 重要提醒

请严格按照上述格式和要求提取事件：
- **只输出 JSON**：直接以 { 开头，严禁使用 \`\`\`json 或 \`\`\` 包裹，不要任何解释性文字
- **使用人物本名**（如"刘邦"而非"高祖"或"沛公"）
- **每个事件必须关联到相关段落ID**（relatedParagraphs字段），这对于阅读时的定位非常重要
- **确保事件摘要完整**，不遗漏关键细节
- **按时间顺序排列事件**（根据 timeRangeStart）
- **最多提取50个最重要的事件**（级别1-3），忽略级别4-5的小规模事件
- **每个事件最多包含5个最重要的actors**，按重要性排序
- **eventNames 包含所有筛选后的事件名称（最多50个）**，eventDetails 只包含前 ${limit} 个事件的详细信息`
      : ''

  return `你是历史事件提取专家。请从以下文本中提取重要历史事件。

## 输出格式（JSON）

{
  "eventNames": [
    "事件名称1",
    "事件名称2",
    // ... 所有事件名称，按时间顺序（timeRangeStart）排列
  ],
  "eventDetails": [
    // 只返回前 ${limit} 个事件的详细信息
    {
      "name": "事件名称",
      "type": "BATTLE|POLITICAL|PERSONAL|OTHER",
      "timeRangeStart": "开始时间，必须使用公元纪年格式：
        - 公元前：使用'-XX年'或'-XX-月'格式，如'-206年'、'-206-12'（表示公元前206年12月）
        - 公元后：使用'XX年'或'XX-月'格式，如'25年'、'25-12'
        - 不确定的年份：'约-206年'或'约25年'
        
        **重要：朝代纪年转换规则（以十月为岁首的朝代）**
        
        1. **秦朝（公元前221-前207年）和汉朝初期（公元前206-前104年）**：
           这两个朝代都以十月为岁首（一年的开始是十月），转换时需注意：
           - X年十月、十一月、十二月 = 该年号对应公元年份的10月、11月、12月
           - X年一月到九月 = 该年号对应公元年份+1年的1月到9月
           
           关键年号对应：
           - 秦始皇元年 = 公元前221年
           - 秦二世元年 = 公元前209年
           - 汉元年 = 公元前206年（刘邦称汉王）
           
           示例：
           - 秦始皇二十六年十月 = 公元前221年10月
           - 秦始皇二十六年一月 = 公元前220年1月
           - 秦二世元年十月 = 公元前209年10月
           - 秦二世元年一月 = 公元前208年1月
           - 汉元年十月 = 公元前206年10月
           - 汉元年一月 = 公元前205年1月
           - 汉十二年四月 = 公元前195年4月
           - 汉十二年十月 = 公元前196年10月
        
        2. **汉武帝太初元年（公元前104年）之后**：
           岁首改为正月，月份直接对应，无需特殊转换。
        
        3. **其他朝代**：直接查找该年号对应的公元年份，月份直接对应。
        
        4. **不要使用朝代年号格式**：必须转换为公元纪年，不要使用'汉元年'、'秦二世元年'等格式",
      "timeRangeEnd": "结束时间（可选），格式同上，如持续多年的战争",
      "timePrecision": "EXACT_DATE|MONTH|SEASON|YEAR|DECADE|APPROXIMATE",
      "locationName": "历史地名，格式要求：
        - 单一地名：直接写地名，如'鸿门'
        - 有别名或区域说明：使用'主地名 (别名/区域)'格式，如'鸿门 (戏)'表示鸿门是主地名，戏是别名或区域
        - 多个地点：用逗号分隔，如'鸿门, 彭城'
        - 括号内的内容将作为别名存储，用于关联Place数据表",
      "locationModernName": "现代地名（如知道）",
      "summary": "事件摘要（200-400字，要点式）",
      "impact": "历史影响（100-200字，可选）",
      ${relatedParagraphsField}
      "actors": [
        {
          "name": "人物姓名",
          "roleType": "PROTAGONIST|ALLY|OPPOSING|ADVISOR|EXECUTOR|OBSERVER|OTHER",
          "description": "此人在事件中的具体表现（50-100字）"
        }
      ]
      // **注意**：actors 数组最多包含5个最重要的参与者，按重要性排序。如果参与者超过5个，只选择最重要的5个。
    }
  ],
  "offset": 0,
  "limit": ${limit}
}

## 示例输出

{
  "eventNames": [
    "刘邦观秦始皇",
    "吕公嫁女于刘邦",
    "鸿门宴"
  ],
  "eventDetails": [
    {
      "name": "刘邦观秦始皇",
      "type": "PERSONAL",
      "timeRangeStart": "-210年",
      "timeRangeEnd": null,
      "timePrecision": "APPROXIMATE",
      "locationName": "咸阳",
      "locationModernName": null,
      "summary": "刘邦在咸阳时，曾远观秦始皇帝出游的盛况，感叹道："嗟乎，大丈夫当如此也！"此言显露了其非凡的抱负和建立功业的志向。",
      "impact": null,
      ${relatedParagraphsExample}
      "actors": [
        {
          "name": "刘邦",
          "roleType": "PROTAGONIST",
          "description": "观秦始皇出游，发出大丈夫当如此的感慨，表明其远大志向。"
        }
      ]
    }
  ],
  "offset": 0,
  "limit": ${limit}
}

## 提取要求

1. **事件选择与重要性筛选**：
   - **最多提取50个最重要的事件**，按时间顺序（timeRangeStart）排列，放入 eventNames 数组
   - **重要性分级标准**（1-5级，只提取1-3级）：
     - **级别1（对历史走向有重大影响）**：改朝换代、重大战役、关键决策、影响历史进程的重大事件
     - **级别2（对局势有重大影响）**：重要政治事件、重大军事行动、影响地区或国家局势的事件
     - **级别3（对人物有重大影响）**：重要人物生死、关键转折点、影响主要人物命运的事件
     - **级别4（中等规模事件）**：一般战役、次要政治事件、局部冲突等（不提取）
     - **级别5（小规模事件）**：个人琐事、日常事务、无关紧要的事件（不提取）
   - **只提取级别1-3的事件**，级别4-5的事件应忽略
   - 如果文本中的事件超过50个，优先提取最重要的50个（级别1-3）
2. **事件详情**：只返回前 ${limit} 个事件的完整详细信息，放入 eventDetails 数组
3. **时间精度**：根据文本描述选择合适的时间精度
4. **参与者命名**：
   - actors.name 应使用人物的**本名**（如"刘邦"而非"高祖"或"沛公"）
   - 如果文本中只出现封号/谥号，请推断其本名
   - 这有助于后续的人物去重和关联
5. **参与者数量限制**：每个事件最多包含5个最重要的参与者，按重要性排序。如果参与者超过5个，只选择最重要的5个
6. **参与者角色**：详细描述每个重要人物在事件中的角色和表现
7. **角色类型说明**：
   - PROTAGONIST: 事件主角
   - ALLY: 同盟/支持方
   - OPPOSING: 对立/敌对方
   - ADVISOR: 谋士/顾问
   - EXECUTOR: 执行者/部将
   - OBSERVER: 旁观者/见证者
   - OTHER: 其他
8. **摘要质量**：确保摘要完整叙述事件经过，不遗漏关键细节
9. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹${relatedParagraphsRequirement}

## 待处理文本${formatNote}${processedText}${importantReminder}
`
}

/**
 * 事件提取系统提示词
 */
export function eventSystemPrompt(): string {
  return '你是专业的历史文献分析专家，擅长从古文中提取结构化的历史事件信息。事件名称、人物姓名、地名必须使用简体中文输出。仅输出纯 JSON 对象，直接以 { 开头，严禁使用 markdown 代码块包裹。输出完整的 JSON 对象后必须立即停止，禁止在 JSON 之后添加任何内容。'
}

// ============================================
// 人物提取提示词
// ============================================

/**
 * 构建人物信息补全提示词（章节绑定，不做融合）
 */
export function buildPersonPrompt(text: string, personNames: string[]): string {
  return `你是历史人物研究专家。请根据以下文本，为这些人物补全详细信息。

## 重要：人物去重与别名识别

**注意**：以下名称列表中可能有多个名称指向同一个人（如"高祖"、"沛公"、"刘邦"都是刘邦）。

**命名规则（必须遵守）**：
- **简体中文**：name 和 aliases 中的所有人名必须使用简体中文。若原文为繁体（如「田橫」「項羽」），请转换为简体（「田横」「项羽」）后再输出
- name 字段必须使用人物的**本名**（出生时的姓名），而非封号、谥号或庙号
- 其他所有称呼（字、号、封号、谥号、庙号等）都放入 aliases 数组
- **不要为同一个人创建多条记录**

**示例**：
如果输入名称包含 ["高祖", "沛公", "汉王", "刘邦"]，应该只输出一条记录：
{
  "name": "刘邦",           // ✓ 本名
  "aliases": ["高祖", "沛公", "汉王", "刘季", "高皇帝"],  // 所有其他称呼
  ...
}

**错误示例**（不要这样做）：
- 为"高祖"单独创建一条记录 ✗
- 为"沛公"单独创建一条记录 ✗
- name 使用"高祖"而非"刘邦" ✗

## 需要补全信息的人物列表

${personNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

## 输出格式（JSON）

{
  "persons": [
    {
      "name": "人物本名（不是封号/谥号）",
      "aliases": ["字", "号", "封号", "谥号", "其他称呼"],
      "zi": "字（如「张良字子房」中的子房，可选）",
      "role": "MONARCH|ADVISOR|GENERAL|CIVIL_OFFICIAL|MILITARY_OFFICIAL|RELATIVE|EUNUCH|OTHER",
      "faction": "HAN|CHU|NEUTRAL|OTHER",
      "biography": "人物简介（200-400字，基于文本内容）",
      "birthYear": "出生年份（如知道，格式：前256年）",
      "birthDate": "生辰/诞辰（更精确的出生时间，如知道）",
      "birthPlace": "出生地（如「刘邦，沛丰邑中阳里人」）",
      "deathYear": "去世年份（如知道）",
      "deathPlace": "逝世地（如「崩于长乐宫」「卒于乌江」）",
      "nativePlace": "籍贯（祖籍，如「张良，其先韩人也」）"
    }
  ]
}

## 示例输出

{
  "persons": [
    {
      "name": "刘邦",
      "aliases": ["高祖", "沛公", "汉王", "刘季", "高皇帝"],
      "role": "MONARCH",
      "faction": "HAN",
      "biography": "汉朝开国皇帝，出身沛县平民，早年任亭长。秦末起义，先入关中，约法三章得民心。楚汉之争中，善用人才，以张良、萧何、韩信为核心，最终击败项羽，统一天下，建立汉朝。",
      "birthYear": "前256年",
      "birthPlace": "沛丰邑中阳里",
      "deathYear": "前195年",
      "deathPlace": "长乐宫"
    },
    {
      "name": "项籍",
      "aliases": ["项羽", "西楚霸王"],
      "role": "MONARCH",
      "faction": "CHU",
      "biography": "秦末起义领袖，楚国贵族后裔。力能扛鼎，勇冠三军。巨鹿之战破釜沉舟大败秦军，威震天下。分封诸侯自立为西楚霸王。楚汉之争中因刚愎自用，不善用人，最终败于垓下，乌江自刎。",
      "birthYear": "前232年",
      "nativePlace": "下相",
      "deathYear": "前202年",
      "deathPlace": "乌江"
    }
  ]
}

## 补全要求

1. **简体中文**：name、aliases、biography 等所有人名相关内容必须使用简体中文。繁体需转换为简体
2. **人物去重**：识别指向同一人的不同名称（含繁简异体如「田横」「田橫」），合并为一条记录
3. **本名优先**：name 字段使用本名，其他称呼放入 aliases
4. **角色分类**：
   - MONARCH: 君主/帝王
   - ADVISOR: 谋士/策士
   - GENERAL: 将领/武将
   - CIVIL_OFFICIAL: 文臣
   - MILITARY_OFFICIAL: 武官
   - RELATIVE: 外戚/皇亲
   - EUNUCH: 宦官
   - OTHER: 其他
5. **阵营分类**（根据文本时代背景）：
   - HAN: 汉方/刘邦阵营
   - CHU: 楚方/项羽阵营
   - NEUTRAL: 中立
   - OTHER: 其他
6. **信息来源**：biography 应基于文本内容，不要杜撰
7. **年份格式**：使用"前XXX年"或"前XXX年X月"格式
8. **扩展字段**（zi、birthDate、birthPlace、deathPlace、nativePlace）：文本有则提取，无则省略
9. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹

## 参考文本

${text.slice(0, 15000)}
`
}

/**
 * 人物提取系统提示词
 */
export function personSystemPrompt(): string {
  return '你是专业的历史人物研究专家，擅长从古文中提取人物信息。所有人名必须使用简体中文输出。仅输出纯 JSON 对象，直接以 { 开头，严禁使用 markdown 代码块包裹，不要添加任何解释性文字。'
}

// ============================================
// 地点提取提示词
// ============================================

/**
 * 构建地点信息查询提示词
 */
export function buildLocationPrompt(
  locationName: string,
  year: string,
  chapterText: string,
  existingPlace?: any
): string {
  const existingPlaceSection = existingPlace
    ? `

## 已有的地点数据（用于融合和完善）

以下是在数据库中已存在的地点记录。请检查新文本中的地点信息是否与已有记录匹配：

**${existingPlace.name}** (ID: ${existingPlace.id})
- 别名: ${existingPlace.aliases?.join(', ') || '无'}
- 坐标: ${existingPlace.coordinatesLng && existingPlace.coordinatesLat
    ? `${existingPlace.coordinatesLat}, ${existingPlace.coordinatesLng}`
    : '无'}
- 现代位置: ${existingPlace.modernLocation || '无'}
- 现代地址: ${existingPlace.modernAddress || '无'}
- 地理背景: ${existingPlace.geographicContext?.substring(0, 200) || '无'}${existingPlace.geographicContext && existingPlace.geographicContext.length > 200 ? '...' : ''}
- 来源章节: ${existingPlace.sourceChapterIds?.join(', ') || '无'}

**融合规则**：
- 如果新文本中的地点与已有记录匹配，请**完善已有记录**：
  - 补充新的别名（如果文本中有新的称呼）
  - 补充或完善地理背景（基于新文本内容）
  - 更新 sourceChapterIds（添加新章节ID）
  - 保留已有记录的坐标和现代位置信息（如果已有且准确）
- 如果新文本中的地点与已有记录不匹配，创建新记录
- 如果已有记录的信息更完整，优先保留已有信息，只补充新信息
`
    : ''

  return `你是历史地理研究专家。请查询以下历史地名的详细信息。

## 查询地点

**地点名称**：${locationName}
**历史年份**：${year}
${existingPlaceSection}

## 输出格式（JSON）

{
  "place": {
    "name": "${locationName}",
    "aliases": ["别名1", "别名2"],
    "coordinates": {
      "lng": 116.92695,
      "lat": 34.73800
    },
    "modernLocation": "现代位置描述（省市区+具体位置）",
    "modernAddress": "可搜索的现代地址（如'鸿门宴遗址'）",
    "adminLevel1": "一级行政隶属（如'骊邑附近区域'）",
    "adminLevel2": "二级行政隶属（如'内史'）",
    "adminLevel3": "三级行政隶属（如'秦朝'）",
    "geographicContext": "地理背景描述（100-200字，说明地理位置、地形、战略意义等）",
    "featureType": "地点类型（如'地名/军事节点'、'县'、'郡'）",
    "timeRangeBegin": "开始年份（如'-223'）",
    "timeRangeEnd": "结束年份（如'1264'）",
    "existingId": "已有记录的ID（如果匹配到已有记录，否则不提供此字段）"
  }
}

## 要求

1. **简体中文**：name、aliases 等地点名称必须使用简体中文。若原文为繁体，请转换为简体后再输出
2. **现代位置**：尽可能精确到省市区，如"陕西省西安市临潼区骊山北麓"
3. **坐标**：如果知道现代位置，提供大致坐标（经度、纬度）
4. **历史行政隶属**：按当时的行政区划层级提供
5. **地理背景**：说明地理位置、地形特征、战略意义等
6. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹

## 参考文本

${chapterText.slice(0, 10000)}
`
}

/**
 * 构建批量地点信息查询提示词
 */
export function buildBatchLocationPrompt(
  locationNames: string[],
  locationYears: Map<string, string>,
  chapterText: string,
  chgisResults: Map<string, ExtractedPlace>
): string {
  // 构建地点列表和 CHGIS 数据
  const locationsList = locationNames
    .map((name, index) => {
      const year = locationYears.get(name) || '前209年'
      const chgisData = chgisResults.get(name)
      const chgisInfo = chgisData
        ? `
   - CHGIS 查询结果：
     * 坐标: ${chgisData.coordinates ? `${chgisData.coordinates.lat}, ${chgisData.coordinates.lng}` : '无'}
     * 现代位置: ${chgisData.modernLocation || '无'}
     * 现代地址: ${chgisData.modernAddress || '无'}
     * 行政层级: ${chgisData.adminLevel2 || '无'}`
        : '   - CHGIS 查询结果: 无'

      return `${index + 1}. **${name}**（历史年份: ${year}）${chgisInfo}`
    })
    .join('\n\n')

  const chgisSummary =
    chgisResults.size > 0
      ? `\n\n**注意**：部分地点已有 CHGIS 查询结果（包含坐标和现代位置信息）。请基于这些信息，结合文本内容，补充更丰富的地理背景、战略意义等信息。`
      : ''

  return `你是历史地理研究专家。请根据以下文本，为这些历史地名查询详细信息。

## 需要查询的地点列表

${locationsList}${chgisSummary}

## 输出格式（JSON）

{
  "places": [
    {
      "name": "地点名称",
      "aliases": ["别名1", "别名2"],
      "coordinates": {
        "lng": 116.92695,
        "lat": 34.73800
      },
      "modernLocation": "现代位置描述（省市区+具体位置）",
      "modernAddress": "可搜索的现代地址（如'鸿门宴遗址'）",
      "adminLevel1": "一级行政隶属（如'骊邑附近区域'）",
      "adminLevel2": "二级行政隶属（如'内史'）",
      "adminLevel3": "三级行政隶属（如'秦朝'）",
      "geographicContext": "地理背景描述（100-200字，说明地理位置、地形、战略意义等）",
      "featureType": "地点类型（如'地名/军事节点'、'县'、'郡'）",
      "timeRangeBegin": "开始年份（如'-223'）",
      "timeRangeEnd": "结束年份（如'1264'）"
    }
  ]
}

## 重要要求

1. **简体中文**：name、aliases 等地点名称必须使用简体中文。若原文为繁体，请转换为简体后再输出
2. **必须为所有地点提供信息**：输出数组应包含所有 ${locationNames.length} 个地点
3. **坐标信息**：
   - 如果 CHGIS 提供了坐标，优先使用 CHGIS 的坐标
   - 如果 CHGIS 没有坐标，根据现代位置推断大致坐标
   - 如果无法确定，坐标字段可以为 null
4. **现代位置**：
   - 如果 CHGIS 提供了现代位置，优先使用
   - 如果 CHGIS 没有，根据文本和历史知识推断
   - 尽可能精确到省市区，如"陕西省西安市临潼区骊山北麓"
5. **地理背景**：这是最重要的补充信息，即使有 CHGIS 数据，也要基于文本内容提供：
   - 地理位置描述
   - 地形特征
   - 战略意义
   - 历史重要性
6. **历史行政隶属**：按当时的行政区划层级提供
7. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹

## 参考文本

${chapterText.slice(0, 15000)}
`
}

/**
 * 地点提取系统提示词
 */
export function locationSystemPrompt(): string {
  return '你是专业的历史地理研究专家，擅长查询历史地名的现代位置和历史行政隶属。地点名称必须使用简体中文输出。仅输出纯 JSON 对象，直接以 { 开头，严禁使用 markdown 代码块包裹，不要添加任何解释性文字。'
}

// ============================================
// 段落翻译提示词
// ============================================

/**
 * 构建段落翻译提示词
 * 使用段落序号（1-based）而非 UUID，避免 LLM 转录长 ID 时出错
 */
export function buildTranslationPrompt(
  bookName: string,
  chapterTitle: string,
  paragraphs: { id: string; text: string; index: number }[]
): string {
  const paragraphLines = paragraphs
    .map((p) => `## 段落 ${p.index}\n${p.text.trim()}`)
    .join('\n\n')
  return `你是古文翻译专家。请将以下文言文段落翻译成通俗的现代汉语。

## 书籍与章节
- 书籍：${bookName}
- 章节：${chapterTitle}

## 输出格式（严格 JSON）
{
  "translations": [
    { "paragraphIndex": 1, "translation": "现代文译文" },
    ...
  ]
}

## 要求
1. 每段原文对应一条翻译，paragraphIndex 必须与输入中的「段落 N」的 N 完全一致
2. 专有名词（人名、地名）可保留原文，或加括号注现代名
3. 保持段落一一对应，不要合并或拆分
4. **仅输出纯 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹，不要任何前后缀或说明文字

## 待翻译段落

${paragraphLines}
`
}

export function translationSystemPrompt(): string {
  return '你是专业的古文翻译专家，擅长将文言文翻译成通俗易懂的现代汉语。仅输出纯 JSON 对象，直接以 { 开头，严禁使用 markdown 代码块包裹。每段对应一条翻译，paragraphIndex 为段落序号（与输入中的「段落 N」一致）。'
}

// ============================================
// 实体提及标注提示词
// ============================================

/**
 * 构建实体提及提取提示词
 */
export function buildMentionExtractPrompt(
  paragraphs: { id: string; text: string }[],
  persons: { id: string; name: string; aliases: string[] }[],
  places: { id: string; name: string; aliases: string[] }[]
): string {
  const paragraphLines = paragraphs
    .map((p) => `[${p.id}] ${p.text.trim()}`)
    .join('\n\n')
  const personLines = persons
    .map((p) => `- ${p.id}: ${p.name}${p.aliases?.length ? ` (别称: ${p.aliases.join('、')})` : ''}`)
    .join('\n')
  const placeLines = places
    .map((p) => `- ${p.id}: ${p.name}${p.aliases?.length ? ` (别称: ${p.aliases.join('、')})` : ''}`)
    .join('\n')

  return `你是古文实体识别专家。请从以下段落中标注所有人物和地点的提及位置。

## 人物列表（只标注以下人物）
${personLines || '（无）'}

## 地点列表（只标注以下地点）
${placeLines || '（无）'}

## 输出格式（严格 JSON）
{
  "mentions": [
    {
      "paragraphId": "段落ID",
      "entityType": "PERSON" 或 "PLACE",
      "entityId": "对应人物或地点的id",
      "startIndex": 0,
      "endIndex": 2
    }
  ]
}

## 索引规则
- startIndex: 字符起始位置（0-based，含）
- endIndex: 字符结束位置（不含）
- 例："高祖" 在段落开头 → startIndex=0, endIndex=2

## 要求
1. 仅标注上述人物和地点列表中的实体，不要标注未列出的
2. 别名需正确映射到对应 entityId（如"沛公"→刘邦的id）
3. 同一 span 只标注一次，取最具体的实体（如"沛丰邑"中"沛""丰邑"分别标）
4. 若某字为多义词（如"将"），仅在人名/地名含义时标注，不标"将军"中的"将"
5. 重叠 span 时，取更长的匹配（如"刘邦"优先于"刘"）
6. **只输出 JSON**：直接以 { 开头、以 } 结尾，严禁使用 \`\`\`json 或 \`\`\` 包裹

## 待标注段落

${paragraphLines}
`
}

export function mentionExtractSystemPrompt(): string {
  return '你是专业的古文实体识别专家，能准确识别文中人物和地点的提及位置。仅输出纯 JSON 对象，直接以 { 开头，严禁使用 markdown 代码块包裹。startIndex 和 endIndex 为字符索引（0-based，endIndex 不含）。'
}

