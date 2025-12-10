import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { api } from '../../lib/api'

const relationshipTypeOptions = [
  { value: 'ALLY', label: '盟友' },
  { value: 'ENEMY', label: '敌对' },
  { value: 'SUPERIOR', label: '上级' },
  { value: 'SUBORDINATE', label: '下级' },
  { value: 'KINSHIP', label: '族亲' },
  { value: 'TEACHER_STUDENT', label: '师徒' },
  { value: 'OTHER', label: '其他' },
]

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

type RelationshipItem = {
  id: string
  sourceId: string
  targetId: string
  type: string
  status: string
  description?: string | null
  confidence?: number | null
  timeRangeStart?: string | null
  timeRangeEnd?: string | null
  sourcePerson?: { id: string; name: string }
  targetPerson?: { id: string; name: string }
}

function RelationshipsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<RelationshipItem | null>(null)
  const [form, setForm] = useState({
    sourceId: '',
    targetId: '',
    type: 'OTHER',
    status: 'DRAFT',
    description: '',
    confidence: 3,
    referenceChapters: '',
    timeRangeStart: null as Date | null,
    timeRangeEnd: null as Date | null,
  })

  const { data: relationshipsData, isLoading } = useQuery({
    queryKey: ['relationships', { page, type, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      const res = await api.get(`/api/admin/relationships?${params.toString()}`)
      return res.data
    },
  })

  const { data: personOptions } = useQuery({
    queryKey: ['persons', 'options', 'relationships'],
    queryFn: async () => {
      const res = await api.get('/api/admin/persons?page=1&pageSize=300&status=PUBLISHED')
      return (res.data?.items || []).map((p: any) => ({
        value: p.id,
        label: p.name,
      }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/relationships/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...data } = payload
        return api.put(`/api/admin/relationships/${id}`, data)
      }
      return api.post('/api/admin/relationships', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] })
      setEditModalOpen(false)
      setEditing(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      sourceId: '',
      targetId: '',
      type: 'OTHER',
      status: 'DRAFT',
      description: '',
      confidence: 3,
      referenceChapters: '',
      timeRangeStart: null,
      timeRangeEnd: null,
    })
    setEditModalOpen(true)
  }

  const openEdit = (item: RelationshipItem) => {
    setEditing(item)
    setForm({
      sourceId: item.sourceId,
      targetId: item.targetId,
      type: item.type || 'OTHER',
      status: item.status || 'DRAFT',
      description: item.description || '',
      confidence: item.confidence || 3,
      referenceChapters: '',
      timeRangeStart: item.timeRangeStart ? new Date(item.timeRangeStart) : null,
      timeRangeEnd: item.timeRangeEnd ? new Date(item.timeRangeEnd) : null,
    })
    setEditModalOpen(true)
  }

  const handleSave = () => {
    if (!form.sourceId || !form.targetId || !form.type) {
      alert('请选择源人物、目标人物和关系类型')
      return
    }
    const payload: any = {
      sourceId: form.sourceId,
      targetId: form.targetId,
      type: form.type,
      status: form.status,
      description: form.description,
      confidence: form.confidence,
      referenceChapters: form.referenceChapters
        ? form.referenceChapters.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      timeRange: {
        start: form.timeRangeStart ? form.timeRangeStart.toISOString() : undefined,
        end: form.timeRangeEnd ? form.timeRangeEnd.toISOString() : undefined,
      },
    }
    if (editing?.id) payload.id = editing.id
    saveMutation.mutate(payload)
  }

  const relationships = relationshipsData?.items || []

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>关系管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          新建关系
        </Button>
      </Group>

      <Group mb="md">
        <Select
          placeholder="关系类型"
          data={[{ value: '', label: '全部类型' }, ...relationshipTypeOptions]}
          value={type}
          onChange={(v) => setType(v || '')}
        />
        <Select
          placeholder="状态"
          data={[{ value: '', label: '全部状态' }, ...statusOptions]}
          value={status}
          onChange={(v) => setStatus(v || '')}
        />
      </Group>

      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>源人物</Table.Th>
            <Table.Th>目标人物</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>置信度</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ width: 140 }}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {relationships.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center">
                  {isLoading ? '加载中...' : '暂无关系'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            relationships.map((item: RelationshipItem) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.sourcePerson?.name || item.sourceId}</Table.Td>
                <Table.Td>{item.targetPerson?.name || item.targetId}</Table.Td>
                <Table.Td>
                  <Badge>
                    {relationshipTypeOptions.find((o) => o.value === item.type)?.label || item.type}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.confidence ?? '-'}</Table.Td>
                <Table.Td>
                  <Badge color={item.status === 'PUBLISHED' ? 'green' : 'yellow'}>
                    {item.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="light" size="sm" onClick={() => openEdit(item)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      size="sm"
                      onClick={() => {
                        if (confirm(`确定删除该关系吗？`)) {
                          deleteMutation.mutate(item.id)
                        }
                      }}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Group justify="flex-end" mt="md">
        <Button
          variant="light"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          上一页
        </Button>
        <Text size="sm">
          第 {page} 页 / 共 {relationshipsData?.totalPages || 1} 页
        </Text>
        <Button
          variant="light"
          onClick={() => setPage(Math.min((relationshipsData?.totalPages || 1), page + 1))}
          disabled={page >= (relationshipsData?.totalPages || 1)}
        >
          下一页
        </Button>
      </Group>

      <Modal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditing(null)
        }}
        title={editing ? '编辑关系' : '新建关系'}
        size="lg"
      >
        <Stack gap="md">
          <Group grow>
            <Select
              label="源人物"
              data={personOptions || []}
              value={form.sourceId}
              onChange={(v) => setForm((prev) => ({ ...prev, sourceId: v || '' }))}
              searchable
            />
            <Select
              label="目标人物"
              data={personOptions || []}
              value={form.targetId}
              onChange={(v) => setForm((prev) => ({ ...prev, targetId: v || '' }))}
              searchable
            />
          </Group>
          <Group grow>
            <Select
              label="关系类型"
              data={relationshipTypeOptions}
              value={form.type}
              onChange={(v) => setForm((prev) => ({ ...prev, type: v || 'OTHER' }))}
            />
            <Select
              label="状态"
              data={statusOptions}
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: v || 'DRAFT' }))}
            />
          </Group>
          <NumberInput
            label="置信度（1-5）"
            min={1}
            max={5}
            value={form.confidence}
            onChange={(v) => setForm((prev) => ({ ...prev, confidence: Number(v) || 1 }))}
          />
          <Group grow>
            <DateInput
              label="开始时间（可选）"
              value={form.timeRangeStart}
              onChange={(v) => setForm((prev) => ({ ...prev, timeRangeStart: v }))}
            />
            <DateInput
              label="结束时间（可选）"
              value={form.timeRangeEnd}
              onChange={(v) => setForm((prev) => ({ ...prev, timeRangeEnd: v }))}
            />
          </Group>
          <Textarea
            label="描述"
            minRows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <TextInput
            label="参考章节（逗号分隔，可选）"
            placeholder="chapter_1, chapter_2"
            value={form.referenceChapters}
            onChange={(e) => setForm((prev) => ({ ...prev, referenceChapters: e.target.value }))}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setEditModalOpen(false)}>
              取消
            </Button>
            <Button loading={saveMutation.isPending} onClick={handleSave}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}

export default RelationshipsPage

