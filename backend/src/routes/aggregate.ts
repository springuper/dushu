import express from 'express'
import { prisma } from '../lib/prisma'
import { createLogger } from '../lib/logger'
import { LLMService } from '../lib/llm'

const router = express.Router()
const logger = createLogger('aggregate')
const llmService = new LLMService()

// 聚合人物信息的 API
router.get('/person', async (req, res) => {
  const { name } = req.query

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '请提供人物名称' })
  }

  try {
    // 1. 查询数据库中所有同名的记录
    const persons = await prisma.person.findMany({
      where: {
        name: name,
        status: 'PUBLISHED',
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (persons.length === 0) {
      return res.status(404).json({ error: '未找到相关人物信息' })
    }

    // 如果只有一条记录，直接返回，无需聚合
    if (persons.length === 1) {
      return res.json({
        name: name,
        aggregatedBiography: persons[0].biography,
        sourceCount: 1,
        sources: persons,
      })
    }

    // 2. 将信息整合成 Prompt
    const historicalRecords = persons.map((p, index) => {
      return `记录 ${index + 1} (来源章节ID: ${p.sourceChapterIds.join(', ')}):
- 简介: ${p.biography}
- 阵营: ${p.faction}
- 角色: ${p.role}`
    }).join('\n\n')

    const systemPrompt = `你是一个专业的历史学家和数据整合专家。你的任务是根据提供的多条分散的历史记录，生成一份关于特定历史人物的全面、连贯、统一的生平简介。`
    const userPrompt = `请根据以下关于历史人物“${name}”的多条历史记录，综合、整理并生成一份全面、连贯的人物介绍。请遵循以下规则：
1.  **消除冗余**：整合重复或相似的信息，不要简单罗列。
2.  **逻辑连贯**：尽可能按照时间线或逻辑关系（如早年、崛起、主要成就、晚年等）来组织内容。
3.  **中立客观**：以第三方视角进行叙述，避免使用“记录1说”、“记录2说”这样的句式。
4.  **关键信息**：确保提及人物的关键角色、所属阵营的变化（如果信息中有体现）以及重要的生平事迹。
5.  **输出格式**：直接输出整合后的生平简介文本，无需任何额外的标题或前言。\n\n**原始记录:**\n\n${historicalRecords}`

    // 3. 调用 LLM API
    const aggregatedBiography = await llmService.call(userPrompt, systemPrompt, 0.2, `aggregate-person-${name}`)

    // 4. 返回聚合信息
    res.json({
      name: name,
      aggregatedBiography: aggregatedBiography,
      sourceCount: persons.length,
      sources: persons, // 同时返回原始数据源以供前端调试或展示
    })

  } catch (error: any) {
    logger.error('Error aggregating person data', { name, error: error.message })
    res.status(500).json({ error: '聚合信息时发生内部错误' })
  }
})

export default router
