/**
 * 变更日志服务
 * 记录所有数据变更，支持版本历史和 diff
 */

import { prisma } from './prisma'
import { Person, Place, Event, Relationship } from '@prisma/client'

export type EntityType = 'PERSON' | 'PLACE' | 'EVENT' | 'RELATIONSHIP'
export type ChangeAction = 'CREATE' | 'UPDATE' | 'MERGE' | 'DELETE'

export interface ChangeLogData {
  entityType: EntityType
  entityId: string
  action: ChangeAction
  previousData?: any // 变更前的数据
  currentData: any // 变更后的数据
  changes?: Record<string, any> // 变更详情（diff）
  changedBy?: string // 变更人ID
  changeReason?: string // 变更原因
  mergedFrom?: string[] // 如果是从其他记录合并而来，记录源记录ID
}

/**
 * 记录变更
 */
export async function logChange(data: ChangeLogData): Promise<void> {
  // 获取当前版本号
  const lastVersion = await prisma.changeLog.findFirst({
    where: {
      entityType: data.entityType,
      entityId: data.entityId,
    },
    orderBy: {
      version: 'desc',
    },
    select: {
      version: true,
    },
  })

  const version = (lastVersion?.version || 0) + 1

  await prisma.changeLog.create({
    data: {
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      version,
      previousData: data.previousData || null,
      currentData: data.currentData,
      changes: data.changes || null,
      changedBy: data.changedBy || null,
      changeReason: data.changeReason || null,
      mergedFrom: data.mergedFrom || [],
    },
  })
}

/**
 * 获取实体的变更历史
 */
export async function getChangeHistory(
  entityType: EntityType,
  entityId: string
) {
  return prisma.changeLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      version: 'asc',
    },
  })
}

/**
 * 获取特定版本的数据
 */
export async function getVersionData(
  entityType: EntityType,
  entityId: string,
  version: number
) {
  const log = await prisma.changeLog.findFirst({
    where: {
      entityType,
      entityId,
      version,
    },
  })

  return log?.currentData || null
}

/**
 * 计算两个版本之间的 diff
 */
export function calculateDiff(oldData: any, newData: any): Record<string, any> {
  const diff: Record<string, any> = {}

  // 简单的 diff 算法（可以扩展更复杂的）
  const allKeys = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ])

  for (const key of allKeys) {
    const oldValue = oldData?.[key]
    const newValue = newData?.[key]

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      if (oldValue === undefined) {
        diff[key] = { added: newValue }
      } else if (newValue === undefined) {
        diff[key] = { removed: oldValue }
      } else {
        diff[key] = {
          from: oldValue,
          to: newValue,
        }
      }
    }
  }

  return diff
}

/**
 * 获取变更统计
 */
export async function getChangeStats(entityType: EntityType, entityId: string) {
  const logs = await getChangeHistory(entityType, entityId)

  return {
    totalVersions: logs.length,
    firstVersion: logs[0]?.version || 0,
    lastVersion: logs[logs.length - 1]?.version || 0,
    createdBy: logs.find((l) => l.action === 'CREATE')?.changedBy,
    createdAt: logs.find((l) => l.action === 'CREATE')?.createdAt,
    lastModifiedBy: logs[logs.length - 1]?.changedBy,
    lastModifiedAt: logs[logs.length - 1]?.createdAt,
    mergeCount: logs.filter((l) => l.action === 'MERGE').length,
  }
}

