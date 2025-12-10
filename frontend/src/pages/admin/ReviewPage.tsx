import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Container,
  Title,
  Table,
  Badge,
  Button,
  Group,
  TextInput,
  Select,
  Checkbox,
  ActionIcon,
  Modal,
  Textarea,
  Stack,
  Text,
  Paper,
  Divider,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconEdit, IconCheck, IconX, IconTrash } from '@tabler/icons-react'

const REVIEW_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'PERSON', label: '人物' },
  { value: 'RELATIONSHIP', label: '关系' },
  { value: 'PLACE', label: '地点' },
  { value: 'EVENT', label: '事件' },
]

const REVIEW_STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'MODIFIED', label: '已修改' },
]

function ReviewPage() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailModal, setDetailModal] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    open: boolean
    action: 'approve' | 'reject' | null
    ids: string[]
  }>({ open: false, action: null, ids: [] })

  const queryClient = useQueryClient()

  // 获取 Review 列表
  const { data, isLoading } = useQuery({
    queryKey: ['review', 'items', { type, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      if (search) params.append('search', search)

      const response = await api.get(`/api/admin/review/items?${params.toString()}`)
      return response.data
    },
  })

  // 批量通过
  const batchApproveMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const response = await api.post('/api/admin/review/batch-approve', { ids, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      setActionModal({ open: false, action: null, ids: [] })
      setSelectedIds([])
    },
  })

  // 批量拒绝
  const batchRejectMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const response = await api.post('/api/admin/review/batch-reject', { ids, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      setActionModal({ open: false, action: null, ids: [] })
      setSelectedIds([])
    },
  })

  const handleBatchAction = (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) return
    setActionModal({ open: true, action, ids: selectedIds })
  }

  const handleConfirmAction = (notes?: string) => {
    if (actionModal.action === 'approve' && actionModal.ids.length > 0) {
      batchApproveMutation.mutate({ ids: actionModal.ids, notes })
    } else if (actionModal.action === 'reject' && actionModal.ids.length > 0) {
      batchRejectMutation.mutate({ ids: actionModal.ids, notes })
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'yellow',
      APPROVED: 'green',
      REJECTED: 'red',
      MODIFIED: 'blue',
    }
    const labels: Record<string, string> = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已拒绝',
      MODIFIED: '已修改',
    }
    return <Badge color={colors[status] || 'gray'}>{labels[status] || status}</Badge>
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PERSON: '人物',
      RELATIONSHIP: '关系',
      PLACE: '地点',
      EVENT: '事件',
    }
    return labels[type] || type
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Review 工具</Title>
        <Group>
          <Button
            color="green"
            onClick={() => handleBatchAction('approve')}
            disabled={selectedIds.length === 0}
            loading={batchApproveMutation.isPending}
          >
            批量通过 ({selectedIds.length})
          </Button>
          <Button
            color="red"
            onClick={() => handleBatchAction('reject')}
            disabled={selectedIds.length === 0}
            loading={batchRejectMutation.isPending}
          >
            批量拒绝 ({selectedIds.length})
          </Button>
        </Group>
      </Group>

      {/* 筛选器 */}
      <Paper p="md" mb="md" withBorder>
        <Group>
          <Select
            label="类型"
            data={REVIEW_TYPES}
            value={type}
            onChange={(value) => setType(value || '')}
            style={{ flex: 1 }}
          />
          <Select
            label="状态"
            data={REVIEW_STATUSES}
            value={status}
            onChange={(value) => setStatus(value || '')}
            style={{ flex: 1 }}
          />
          <TextInput
            label="搜索"
            placeholder="搜索名称或 ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 2 }}
          />
        </Group>
      </Paper>

      {/* 列表 */}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={selectedIds.length === data?.items.length && data?.items.length > 0}
                indeterminate={selectedIds.length > 0 && selectedIds.length < (data?.items.length || 0)}
                onChange={(e) => {
                  if (e.currentTarget.checked) {
                    setSelectedIds(data?.items.map((item: any) => item.id) || [])
                  } else {
                    setSelectedIds([])
                  }
                }}
              />
            </Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>名称/ID</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>来源</Table.Th>
            <Table.Th>创建时间</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={7} ta="center">
                加载中...
              </Table.Td>
            </Table.Tr>
          ) : data?.items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} ta="center">
                暂无数据
              </Table.Td>
            </Table.Tr>
          ) : (
            data?.items.map((item: any) => {
              const originalData = item.originalData || {}
              const name = originalData.name || originalData.id || item.id

              return (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          setSelectedIds([...selectedIds, item.id])
                        } else {
                          setSelectedIds(selectedIds.filter((id) => id !== item.id))
                        }
                      }}
                    />
                  </Table.Td>
                  <Table.Td>{getTypeLabel(item.type)}</Table.Td>
                  <Table.Td>{name}</Table.Td>
                  <Table.Td>{getStatusBadge(item.status)}</Table.Td>
                  <Table.Td>
                    {item.source === 'LLM_EXTRACT' ? 'LLM 提取' : '手动录入'}
                  </Table.Td>
                  <Table.Td>
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setDetailModal(item.id)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })
          )}
        </Table.Tbody>
      </Table>

      {/* 详情 Modal */}
      <ReviewDetailModal
        itemId={detailModal}
        onClose={() => setDetailModal(null)}
      />

      {/* 批量操作 Modal */}
      <Modal
        opened={actionModal.open}
        onClose={() => setActionModal({ open: false, action: null, ids: [] })}
        title={actionModal.action === 'approve' ? '批量通过' : '批量拒绝'}
      >
        <Stack>
          <Text>
            确定要{actionModal.action === 'approve' ? '通过' : '拒绝'} {actionModal.ids.length} 个项目吗？
            {actionModal.action === 'approve' && (
              <Text size="sm" c="dimmed" mt="xs" component="div">
                通过后将直接发布（状态设为 PUBLISHED）
              </Text>
            )}
          </Text>
          <Textarea
            label="备注（可选）"
            placeholder="输入审核备注"
            id="batch-notes"
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setActionModal({ open: false, action: null, ids: [] })}
            >
              取消
            </Button>
            <Button
              color={actionModal.action === 'approve' ? 'green' : 'red'}
              onClick={() => {
                const notes = (document.getElementById('batch-notes') as HTMLTextAreaElement)?.value
                handleConfirmAction(notes)
              }}
              loading={
                batchApproveMutation.isPending || batchRejectMutation.isPending
              }
            >
              确认
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}

// Review 详情 Modal 组件
function ReviewDetailModal({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const [notes, setNotes] = useState('')
  const [modifiedData, setModifiedData] = useState<any>(null)

  const { data: item, isLoading } = useQuery({
    queryKey: ['review', 'item', itemId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/review/items/${itemId}`)
      return response.data
    },
    enabled: !!itemId,
  })

  const queryClient = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/admin/review/items/${itemId}/approve`, { notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      onClose()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/admin/review/items/${itemId}/reject`, { notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/admin/review/items/${itemId}/update`, {
        modifiedData: modifiedData || item?.originalData,
        notes,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      onClose()
    },
  })

  if (!itemId) return null

  const originalData = item?.originalData || {}
  const currentData = modifiedData || item?.modifiedData || originalData

  return (
    <Modal
      opened={!!itemId}
      onClose={onClose}
      title="Review 详情"
      size="xl"
    >
      {isLoading ? (
        <Text>加载中...</Text>
      ) : (
        <Stack>
          <div>
            <Text fw={500} mb="xs">类型：{item?.type}</Text>
            <Text fw={500} mb="xs">状态：{item?.status}</Text>
          </div>

          <Divider />

          <div>
            <Text fw={500} mb="xs">原始数据：</Text>
            <Paper p="sm" withBorder style={{ maxHeight: 200, overflow: 'auto' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>
                {JSON.stringify(originalData, null, 2)}
              </pre>
            </Paper>
          </div>

          <div>
            <Text fw={500} mb="xs">修正数据（可编辑）：</Text>
            <Textarea
              value={JSON.stringify(currentData, null, 2)}
              onChange={(e) => {
                try {
                  setModifiedData(JSON.parse(e.target.value))
                } catch {
                  // 忽略 JSON 解析错误
                }
              }}
              minRows={10}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <Textarea
            label="审核备注"
            placeholder="输入审核备注"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              取消
            </Button>
            <Button
              color="red"
              onClick={() => rejectMutation.mutate()}
              loading={rejectMutation.isPending}
            >
              拒绝
            </Button>
            <Button
              color="blue"
              onClick={() => updateMutation.mutate()}
              loading={updateMutation.isPending}
            >
              保存修改
            </Button>
            <Button
              color="green"
              onClick={() => approveMutation.mutate()}
              loading={approveMutation.isPending}
            >
              通过
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

export default ReviewPage

