/**
 * 变更日志 API
 */

import express from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { getChangeHistory, getVersionData, getChangeStats, calculateDiff } from '../lib/changeLog'

const router = express.Router()

// 获取实体的变更历史
router.get('/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params

    const history = await getChangeHistory(
      entityType.toUpperCase() as any,
      entityId
    )

    res.json(history)
  } catch (error) {
    console.error('Get change history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取特定版本的数据
router.get('/:entityType/:entityId/version/:version', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId, version } = req.params

    const data = await getVersionData(
      entityType.toUpperCase() as any,
      entityId,
      parseInt(version)
    )

    if (!data) {
      return res.status(404).json({ error: 'Version not found' })
    }

    res.json(data)
  } catch (error) {
    console.error('Get version data error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 获取变更统计
router.get('/:entityType/:entityId/stats', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params

    const stats = await getChangeStats(
      entityType.toUpperCase() as any,
      entityId
    )

    res.json(stats)
  } catch (error) {
    console.error('Get change stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 计算两个版本之间的 diff
router.get('/:entityType/:entityId/diff/:fromVersion/:toVersion', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId, fromVersion, toVersion } = req.params

    const fromData = await getVersionData(
      entityType.toUpperCase() as any,
      entityId,
      parseInt(fromVersion)
    )

    const toData = await getVersionData(
      entityType.toUpperCase() as any,
      entityId,
      parseInt(toVersion)
    )

    if (!fromData || !toData) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const diff = calculateDiff(fromData, toData)

    res.json({
      fromVersion: parseInt(fromVersion),
      toVersion: parseInt(toVersion),
      diff,
    })
  } catch (error) {
    console.error('Calculate diff error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

