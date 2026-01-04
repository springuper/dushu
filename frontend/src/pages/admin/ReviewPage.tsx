/**
 * 审核页面（事件中心 MVP 版本）
 * 
 * 处理 EVENT、PERSON 和 PLACE 三种类型
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Container,
  Title,
  Table,
  Badge,
  Button,
  Group,
  Select,
  Checkbox,
  Modal,
  Textarea,
  Stack,
  Text,
  Paper,
  Divider,
  Code,
  Tabs,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconCheck, IconX, IconEye, IconChevronDown, IconChevronUp } from '@tabler/icons-react'

const REVIEW_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'EVENT', label: '事件' },
  { value: 'PERSON', label: '人物' },
  { value: 'PLACE', label: '地点' },
]

const REVIEW_STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'MODIFIED', label: '已修改' },
]

const statusColors: Record<string, string> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  MODIFIED: 'blue',
}

const statusLabels: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  MODIFIED: '已修改',
}

const typeLabels: Record<string, string> = {
  EVENT: '事件',
  PERSON: '人物',
  PLACE: '地点',
}

function ReviewPage() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailModal, setDetailModal] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    open: boolean
    action: 'approve' | 'reject' | null
    ids: string[]
  }>({ open: false, action: null, ids: [] })
  const [approveAllModal, setApproveAllModal] = useState(false)
  const [notes, setNotes] = useState('')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['review-items', { type, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      const res = await api.get(`/api/admin/review/items?${params.toString()}`)
      return res.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return api.post(`/api/admin/review/items/${id}/approve`, { notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      setDetailModal(null)
      setActionModal({ open: false, action: null, ids: [] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return api.post(`/api/admin/review/items/${id}/reject`, { notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      setDetailModal(null)
      setActionModal({ open: false, action: null, ids: [] })
    },
  })

  const batchApproveMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      return api.post('/api/admin/review/batch-approve', { ids, notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      setSelectedIds([])
      setActionModal({ open: false, action: null, ids: [] })
    },
  })

  const batchRejectMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      return api.post('/api/admin/review/batch-reject', { ids, notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      setSelectedIds([])
      setActionModal({ open: false, action: null, ids: [] })
    },
  })

  const approveAllMutation = useMutation({
    mutationFn: async ({ type, notes }: { type?: string; notes?: string }) => {
      return api.post('/api/admin/review/approve-all', { type, notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-items'] })
      setApproveAllModal(false)
      setNotes('')
    },
  })

  const items = data?.items || []

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map((item: any) => item.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    }
  }

  const openActionModal = (action: 'approve' | 'reject', ids: string[]) => {
    setNotes('')
    setActionModal({ open: true, action, ids })
  }

  const handleAction = () => {
    const { action, ids } = actionModal
    if (!action || ids.length === 0) return

    if (ids.length === 1) {
      if (action === 'approve') {
        approveMutation.mutate({ id: ids[0], notes })
      } else {
        rejectMutation.mutate({ id: ids[0], notes })
      }
    } else {
      if (action === 'approve') {
        batchApproveMutation.mutate({ ids, notes })
      } else {
        batchRejectMutation.mutate({ ids, notes })
      }
    }
  }

  const renderDataPreview = (item: any) => {
    const data = item.modifiedData || item.originalData
    if (item.type === 'EVENT') {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={500}>{data.name}</Text>
          <Text size="xs" c="dimmed">
            时间: {data.timeRangeStart} | 类型: {data.type}
          </Text>
          <Text size="xs" lineClamp={2}>{data.summary}</Text>
          {data.actors?.length > 0 && (
            <Text size="xs" c="dimmed">
              参与者: {data.actors.map((a: any) => a.name).join(', ')}
            </Text>
          )}
        </Stack>
      )
    }
    if (item.type === 'PERSON') {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={500}>{data.name}</Text>
          <Text size="xs" c="dimmed">
            {data.aliases?.length > 0 && `别名: ${data.aliases.join(', ')} | `}
            角色: {data.role} | 阵营: {data.faction}
          </Text>
          <Text size="xs" lineClamp={2}>{data.biography}</Text>
        </Stack>
      )
    }
    if (item.type === 'PLACE') {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={500}>{data.name}</Text>
          <Text size="xs" c="dimmed">
            {data.aliases?.length > 0 && `别名: ${data.aliases.join(', ')} | `}
            {data.featureType && `类型: ${data.featureType} | `}
            {data.coordinates && data.coordinates.lng != null && data.coordinates.lat != null && `坐标: ${data.coordinates.lng.toFixed(4)}, ${data.coordinates.lat.toFixed(4)}`}
          </Text>
          {data.modernLocation && (
            <Text size="xs" lineClamp={1} c="dimmed">
              现代位置: {data.modernLocation}
            </Text>
          )}
          {data.geographicContext && (
            <Text size="xs" lineClamp={2}>{data.geographicContext}</Text>
          )}
        </Stack>
      )
    }
    return <Text size="xs">{JSON.stringify(data).slice(0, 100)}...</Text>
  }

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">审核管理</Title>

      {/* 筛选器 */}
      <Group mb="md" justify="space-between">
        <Group>
          <Select
            placeholder="类型"
            data={REVIEW_TYPES}
            value={type}
            onChange={(v) => setType(v || '')}
            clearable
          />
          <Select
            placeholder="状态"
            data={REVIEW_STATUSES}
            value={status}
            onChange={(v) => setStatus(v || '')}
            clearable
          />
        </Group>
        {status === 'PENDING' && (
          <Button
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={() => {
              setNotes('')
              setApproveAllModal(true)
            }}
          >
            一键全部通过
          </Button>
        )}
      </Group>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <Group mb="md" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)', borderRadius: 'var(--mantine-radius-md)' }}>
          <Text size="sm" fw={500}>
            已选择 {selectedIds.length} 项
          </Text>
          <Button
            size="xs"
            color="green"
            variant="light"
            leftSection={<IconCheck size={14} />}
            onClick={() => openActionModal('approve', selectedIds)}
          >
            批量通过
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconX size={14} />}
            onClick={() => openActionModal('reject', selectedIds)}
          >
            批量拒绝
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setSelectedIds([])}
          >
            取消选择
          </Button>
        </Group>
      )}

      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={items.length > 0 && selectedIds.length === items.length}
                indeterminate={selectedIds.length > 0 && selectedIds.length < items.length}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
              />
            </Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th style={{ minWidth: 300 }}>内容预览</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>创建时间</Table.Th>
            <Table.Th style={{ width: 180 }}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center">
                  {isLoading ? '加载中...' : '暂无数据'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => handleSelectOne(item.id, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={item.type === 'EVENT' ? 'blue' : 'purple'}>
                    {typeLabels[item.type] || item.type}
                  </Badge>
                </Table.Td>
                <Table.Td>{renderDataPreview(item)}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={statusColors[item.status] || 'gray'}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconEye size={14} />}
                      onClick={() => setDetailModal(item.id)}
                    >
                      详情
                    </Button>
                    {item.status === 'PENDING' && (
                      <>
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          onClick={() => openActionModal('approve', [item.id])}
                        >
                          通过
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => openActionModal('reject', [item.id])}
                        >
                          拒绝
                        </Button>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {/* 分页 */}
      <Group justify="flex-end" mt="md">
        <Button
          variant="light"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          上一页
        </Button>
        <Text size="sm">
          第 {page} 页 / 共 {data?.totalPages || 1} 页
        </Text>
        <Button
          variant="light"
          size="sm"
          onClick={() => setPage(Math.min((data?.totalPages || 1), page + 1))}
          disabled={page >= (data?.totalPages || 1)}
        >
          下一页
        </Button>
      </Group>

      {/* 详情弹窗 */}
      <ReviewDetailModal
        itemId={detailModal}
        onClose={() => setDetailModal(null)}
        onApprove={(id) => openActionModal('approve', [id])}
        onReject={(id) => openActionModal('reject', [id])}
      />

      {/* 操作确认弹窗 */}
      <Modal
        opened={actionModal.open}
        onClose={() => setActionModal({ open: false, action: null, ids: [] })}
        title={actionModal.action === 'approve' ? '确认通过' : '确认拒绝'}
      >
        <Stack gap="md">
          <Text size="sm">
            {actionModal.action === 'approve'
              ? `确定要通过选中的 ${actionModal.ids.length} 项审核吗？`
              : `确定要拒绝选中的 ${actionModal.ids.length} 项审核吗？`}
          </Text>
          <Textarea
            label="备注（可选）"
            placeholder="添加审核备注..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => setActionModal({ open: false, action: null, ids: [] })}
            >
              取消
            </Button>
            <Button
              color={actionModal.action === 'approve' ? 'green' : 'red'}
              onClick={handleAction}
              loading={
                approveMutation.isPending ||
                rejectMutation.isPending ||
                batchApproveMutation.isPending ||
                batchRejectMutation.isPending
              }
            >
              确认
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* 一键全部通过确认弹窗 */}
      <Modal
        opened={approveAllModal}
        onClose={() => setApproveAllModal(false)}
        title="一键全部通过"
      >
        <Stack gap="md">
          <Text size="sm">
            确定要通过所有符合条件的待审核项吗？
            {type && (
              <Text component="span" fw={500}>
                {' '}（类型: {typeLabels[type] || type}）
              </Text>
            )}
          </Text>
          <Text size="xs" c="dimmed">
            此操作将根据当前筛选条件（类型: {type || '全部'}, 状态: 待审核）批量通过所有符合条件的审核项。
          </Text>
          <Textarea
            label="备注（可选）"
            placeholder="添加审核备注..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => setApproveAllModal(false)}
            >
              取消
            </Button>
            <Button
              color="green"
              onClick={() => {
                approveAllMutation.mutate({ type: type || undefined, notes })
              }}
              loading={approveAllMutation.isPending}
            >
              确认全部通过
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}

// 审核详情弹窗
function ReviewDetailModal({
  itemId,
  onClose,
  onApprove,
  onReject,
}: {
  itemId: string | null
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const [expandedSummary, setExpandedSummary] = useState(false)
  const [expandedImpact, setExpandedImpact] = useState(false)
  const [expandedBiography, setExpandedBiography] = useState(false)

  const { data: item, isLoading } = useQuery({
    queryKey: ['review-item', itemId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/review/items/${itemId}`)
      return res.data
    },
    enabled: !!itemId,
  })

  const data = item?.modifiedData || item?.originalData

  // 判断内容是否需要展开（超过约150字符或包含换行）
  const needsExpand = (text: string | null | undefined) => {
    if (!text) return false
    return text.length > 150 || text.includes('\n')
  }

  return (
    <Modal
      opened={!!itemId}
      onClose={onClose}
      title="审核详情"
      size="lg"
    >
      {isLoading ? (
        <Text>加载中...</Text>
      ) : item ? (
        <Tabs defaultValue="preview">
          <Tabs.List>
            <Tabs.Tab value="preview">预览</Tabs.Tab>
            <Tabs.Tab value="raw">原始数据</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="preview" pt="md">
            <Stack gap="md">
              <Group>
                <Badge color={item.type === 'EVENT' ? 'blue' : item.type === 'PERSON' ? 'purple' : 'teal'}>
                  {typeLabels[item.type] || item.type}
                </Badge>
                <Badge color={statusColors[item.status] || 'gray'}>
                  {statusLabels[item.status] || item.status}
                </Badge>
              </Group>

              {item.type === 'EVENT' && data && (
                <>
                  <Paper p="md" withBorder>
                    <Text size="lg" fw={500} mb="xs">{data.name}</Text>
                    <Group gap="xs" mb="sm">
                      <Badge size="sm">{data.type}</Badge>
                      <Text size="sm" c="dimmed">{data.timeRangeStart}</Text>
                      {data.locationName && (
                        <Text size="sm" c="dimmed">| {data.locationName}</Text>
                      )}
                    </Group>
                    <Divider label="摘要" labelPosition="left" mb="sm" />
                    <Stack gap="xs">
                      <Text 
                        size="sm" 
                        style={{ 
                          lineClamp: expandedSummary ? undefined : 3,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {data.summary}
                      </Text>
                      {needsExpand(data.summary) && (
                        <Button
                          variant="subtle"
                          size="xs"
                          compact
                          leftSection={expandedSummary ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                          onClick={() => setExpandedSummary(!expandedSummary)}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {expandedSummary ? '收起' : '展开全部'}
                        </Button>
                      )}
                    </Stack>
                    {data.impact && (
                      <>
                        <Divider label="影响" labelPosition="left" my="sm" />
                        <Stack gap="xs">
                          <Text 
                            size="sm" 
                            style={{ 
                              lineClamp: expandedImpact ? undefined : 3,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {data.impact}
                          </Text>
                          {needsExpand(data.impact) && (
                            <Button
                              variant="subtle"
                              size="xs"
                              compact
                              leftSection={expandedImpact ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                              onClick={() => setExpandedImpact(!expandedImpact)}
                              style={{ alignSelf: 'flex-start' }}
                            >
                              {expandedImpact ? '收起' : '展开全部'}
                            </Button>
                          )}
                        </Stack>
                      </>
                    )}
                    {data.actors?.length > 0 && (
                      <>
                        <Divider label={`参与者 (${data.actors.length})`} labelPosition="left" my="sm" />
                        <Stack gap="xs">
                          {data.actors.map((actor: any, i: number) => (
                            <Group key={i} gap="xs">
                              <Badge size="xs" variant="light">{actor.roleType}</Badge>
                              <Text size="sm">{actor.name}</Text>
                              {actor.description && (
                                <Text size="xs" c="dimmed">- {actor.description}</Text>
                              )}
                            </Group>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Paper>
                </>
              )}

              {item.type === 'PERSON' && data && (
                <Paper p="md" withBorder>
                  <Text size="lg" fw={500} mb="xs">{data.name}</Text>
                  {data.aliases?.length > 0 && (
                    <Text size="sm" c="dimmed" mb="sm">别名: {data.aliases.join(', ')}</Text>
                  )}
                  <Group gap="xs" mb="sm">
                    <Badge size="sm">{data.role}</Badge>
                    <Badge size="sm" variant="light">{data.faction}</Badge>
                    {data.birthYear && <Text size="sm" c="dimmed">{data.birthYear} ~ {data.deathYear || '?'}</Text>}
                  </Group>
                  <Divider label="传记" labelPosition="left" mb="sm" />
                  <Stack gap="xs">
                    <Text 
                      size="sm" 
                      style={{ 
                        lineClamp: expandedBiography ? undefined : 3,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {data.biography}
                    </Text>
                    {needsExpand(data.biography) && (
                      <Button
                        variant="subtle"
                        size="xs"
                        compact
                        leftSection={expandedBiography ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        onClick={() => setExpandedBiography(!expandedBiography)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {expandedBiography ? '收起' : '展开全部'}
                      </Button>
                    )}
                  </Stack>
                </Paper>
              )}

              {item.type === 'PLACE' && data && (
                <Paper p="md" withBorder>
                  <Text size="lg" fw={500} mb="xs">{data.name}</Text>
                  {data.aliases?.length > 0 && (
                    <Text size="sm" c="dimmed" mb="sm">别名: {data.aliases.join(', ')}</Text>
                  )}
                  <Group gap="xs" mb="sm">
                    {data.featureType && <Badge size="sm">{data.featureType}</Badge>}
                    {data.source && <Badge size="sm" variant="light">来源: {data.source}</Badge>}
                    {data.coordinates && data.coordinates.lng != null && data.coordinates.lat != null && (
                      <Text size="sm" c="dimmed">
                        坐标: {data.coordinates.lng.toFixed(4)}, {data.coordinates.lat.toFixed(4)}
                      </Text>
                    )}
                  </Group>
                  {data.modernLocation && (
                    <>
                      <Divider label="现代位置" labelPosition="left" mb="sm" />
                      <Text size="sm">{data.modernLocation}</Text>
                      {data.modernAddress && (
                        <Text size="xs" c="dimmed" mt="xs">可搜索地址: {data.modernAddress}</Text>
                      )}
                    </>
                  )}
                  {(data.adminLevel1 || data.adminLevel2 || data.adminLevel3) && (
                    <>
                      <Divider label="历史行政隶属" labelPosition="left" my="sm" />
                      <Stack gap="xs">
                        {data.adminLevel1 && <Text size="sm">一级: {data.adminLevel1}</Text>}
                        {data.adminLevel2 && <Text size="sm">二级: {data.adminLevel2}</Text>}
                        {data.adminLevel3 && <Text size="sm">三级: {data.adminLevel3}</Text>}
                      </Stack>
                    </>
                  )}
                  {data.geographicContext && (
                    <>
                      <Divider label="地理背景" labelPosition="left" my="sm" />
                      <Text size="sm">{data.geographicContext}</Text>
                    </>
                  )}
                  {(data.timeRangeBegin || data.timeRangeEnd) && (
                    <Text size="xs" c="dimmed" mt="sm">
                      时间范围: {data.timeRangeBegin || '?'} ~ {data.timeRangeEnd || '?'}
                    </Text>
                  )}
                </Paper>
              )}

              {item.status === 'PENDING' && (
                <Group justify="flex-end">
                  <Button
                    color="red"
                    variant="light"
                    onClick={() => onReject(item.id)}
                  >
                    拒绝
                  </Button>
                  <Button
                    color="green"
                    onClick={() => onApprove(item.id)}
                  >
                    通过
                  </Button>
                </Group>
              )}

              {item.reviewerNotes && (
                <Paper p="sm" withBorder bg="gray.0">
                  <Text size="xs" fw={500}>审核备注</Text>
                  <Text size="sm">{item.reviewerNotes}</Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="raw" pt="md">
            <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(item, null, 2)}
            </Code>
          </Tabs.Panel>
        </Tabs>
      ) : null}
    </Modal>
  )
}

export default ReviewPage
