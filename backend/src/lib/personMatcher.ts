/**
 * 人物匹配工具
 * 用于检测和匹配可能重复的人物记录
 */

import { Person } from '@prisma/client'

export interface PersonData {
  name: string
  aliases?: string[]
  birthYear?: string | null
  deathYear?: string | null
  activePeriodStart?: string | null
  activePeriodEnd?: string | null
}

export interface MatchResult {
  person: Person
  confidence: number // 0-1，1 表示完全匹配
  reasons: string[] // 匹配原因
}

/**
 * 查找匹配的人物
 */
export async function findMatchingPerson(
  newPerson: PersonData,
  existingPersons: Person[]
): Promise<MatchResult | null> {
  let bestMatch: MatchResult | null = null
  let bestConfidence = 0

  for (const existing of existingPersons) {
    const match = calculateMatch(newPerson, existing)
    if (match.confidence > bestConfidence) {
      bestConfidence = match.confidence
      bestMatch = match
    }
  }

  // 只返回置信度 >= 0.5 的匹配
  return bestConfidence >= 0.5 ? bestMatch : null
}

/**
 * 计算两个人物记录的匹配度
 */
function calculateMatch(
  newPerson: PersonData,
  existing: Person
): MatchResult {
  const reasons: string[] = []
  let confidence = 0

  // 1. 精确姓名匹配（权重：0.6）
  if (newPerson.name === existing.name) {
    confidence += 0.6
    reasons.push('姓名完全相同')
  }

  // 2. 别名匹配（权重：0.5）
  const newAliases = newPerson.aliases || []
  const existingAliases = existing.aliases || []

  // 检查新记录的别名是否在已有记录的别名中
  const hasMatchingAlias = newAliases.some((alias) =>
    existingAliases.includes(alias)
  )
  // 检查新记录的姓名是否在已有记录的别名中
  const nameInAliases = existingAliases.includes(newPerson.name)
  // 检查已有记录的姓名是否在新记录的别名中
  const existingNameInAliases = newAliases.includes(existing.name)

  if (hasMatchingAlias || nameInAliases || existingNameInAliases) {
    confidence += 0.5
    reasons.push('别名匹配')
  }

  // 3. 时间范围匹配（权重：0.3）
  const timeMatch = matchTimeRange(newPerson, existing)
  if (timeMatch > 0) {
    confidence += timeMatch * 0.3
    reasons.push('时间范围重叠')
  }

  // 限制置信度在 0-1 之间
  confidence = Math.min(confidence, 1)

  return {
    person: existing,
    confidence,
    reasons,
  }
}

/**
 * 匹配时间范围
 * 返回重叠度（0-1）
 */
function matchTimeRange(
  newPerson: PersonData,
  existing: Person
): number {
  // 如果都没有时间信息，返回 0
  if (
    !newPerson.birthYear &&
    !newPerson.deathYear &&
    !newPerson.activePeriodStart &&
    !newPerson.activePeriodEnd &&
    !existing.birthYear &&
    !existing.deathYear &&
    !existing.activePeriodStart &&
    !existing.activePeriodEnd
  ) {
    return 0
  }

  // 简化处理：如果有生年或卒年，检查是否接近
  // 这里可以扩展更复杂的时间匹配逻辑
  if (newPerson.birthYear && existing.birthYear) {
    if (newPerson.birthYear === existing.birthYear) {
      return 1
    }
    // 可以进一步解析年份，计算差值
  }

  if (newPerson.deathYear && existing.deathYear) {
    if (newPerson.deathYear === existing.deathYear) {
      return 1
    }
  }

  // 活跃时期匹配
  if (
    newPerson.activePeriodStart &&
    existing.activePeriodStart &&
    newPerson.activePeriodEnd &&
    existing.activePeriodEnd
  ) {
    // 简化处理：如果时间范围有重叠，返回部分匹配
    // 实际应该解析年份并计算重叠度
    return 0.5
  }

  return 0
}

/**
 * 合并两个人物记录
 */
export function mergePersonData(
  existing: Person,
  newData: PersonData & { biography?: string; keyEvents?: string[] }
): Partial<Person> {
  const merged: Partial<Person> = {
    // 保留已有记录的基础信息
    name: existing.name,
    role: existing.role,
    faction: existing.faction,
    portraitUrl: existing.portraitUrl,
  }

  // 合并别名（去重）
  const allAliases = [
    ...(existing.aliases || []),
    ...(newData.aliases || []),
    newData.name, // 新记录的姓名也可能是别名
  ]
  merged.aliases = Array.from(new Set(allAliases)).filter(
    (alias) => alias !== existing.name // 移除主姓名
  )

  // 合并传记（保留更详细的）
  if (newData.biography) {
    if (existing.biography && newData.biography.length > existing.biography.length) {
      merged.biography = newData.biography
    } else if (!existing.biography) {
      merged.biography = newData.biography
    } else {
      merged.biography = existing.biography
    }
  } else {
    merged.biography = existing.biography
  }

  // 合并关键事件（去重）
  const allEvents = [
    ...(existing.keyEvents || []),
    ...(newData.keyEvents || []),
  ]
  merged.keyEvents = Array.from(new Set(allEvents))

  // 时间信息：保留更精确的
  merged.birthYear = newData.birthYear || existing.birthYear
  merged.deathYear = newData.deathYear || existing.deathYear
  merged.activePeriodStart =
    newData.activePeriodStart || existing.activePeriodStart
  merged.activePeriodEnd = newData.activePeriodEnd || existing.activePeriodEnd

  // 保留已有记录的其他字段
  merged.firstAppearanceChapterId = existing.firstAppearanceChapterId
  merged.firstAppearanceParagraphId = existing.firstAppearanceParagraphId

  return merged
}

