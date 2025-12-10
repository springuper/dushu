import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  MultiSelect,
  Checkbox,
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

function formatDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toISOString().slice(0, 10)
}

function parseDateSafe(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatEventType(value?: string | null) {
  if (!value) return '-'
  const item = eventTypeOptions.find((o) => o.value === value)
  return item?.label || value
}

// 后端枚举：BATTLE | POLITICAL | PERSONAL | OTHER
const eventTypeOptions = [
  { value: 'BATTLE', label: '战争' },
  { value: 'POLITICAL', label: '政治' },
  { value: 'PERSONAL', label: '人物事件' },
  { value: 'OTHER', label: '其他' },
]

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

type EventItem = {
  id: string
  name: string
  timeRangeStart?: string | null
  timeRangeEnd?: string | null
  timeRangeLunar?: boolean | null
  type: string
  status: string
  summary?: string | null
  impact?: string | null
  locationId?: string | null
  location?: { id: string; name: string } | null
  participants?: Array<{
    personId: string
    person?: { id: string; name: string }
  }>
}

function EventsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'OTHER',
    status: 'DRAFT',
    timeRangeStart: null as Date | null,
    timeRangeEnd: null as Date | null,
    lunar: false,
    locationId: '',
    participants: [] as string[],
    summary: '',
    impact: '',
    relatedParagraphs: '',
  })

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events', { page, type, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      const res = await api.get(`/api/admin/events?${params.toString()}`)
      return res.data
    },
  })

  const { data: personsOptions } = useQuery({
    queryKey: ['persons', 'options'],
    queryFn: async () => {
      const res = await api.get('/api/admin/persons?page=1&pageSize=200&status=PUBLISHED')
      return (res.data?.items || []).map((p: any) => ({
        value: p.id,
        label: p.name,
      }))
    },
  })

  const { data: placeOptions } = useQuery({
    queryKey: ['places', 'options'],
    queryFn: async () => {
      const res = await api.get('/api/admin/places?page=1&pageSize=200&status=PUBLISHED')
      return (res.data?.items || []).map((p: any) => ({
        value: p.id,
        label: p.name,
      }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/events/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...data } = payload
        return api.put(`/api/admin/events/${id}`, data)
      }
      return api.post('/api/admin/events', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEditModalOpen(false)
      setEditing(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      type: 'OTHER',
      status: 'DRAFT',
      timeRangeStart: null,
      timeRangeEnd: null,
      lunar: false,
      locationId: '',
      participants: [],
      summary: '',
      impact: '',
      relatedParagraphs: '',
    })
    setEditModalOpen(true)
  }

  const openEdit = (item: EventItem) => {
    setEditing(item)
    setForm({
      name: item.name || '',
      type: item.type || 'OTHER',
      status: item.status || 'DRAFT',
      timeRangeStart: parseDateSafe(item.timeRangeStart),
      timeRangeEnd: parseDateSafe(item.timeRangeEnd),
      lunar: item.timeRangeLunar === true || item.timeRangeLunar === 'true',
      locationId: item.locationId || '',
      participants: (item.participants || []).map((p) => p.personId),
      summary: item.summary || '',
      impact: item.impact || '',
      relatedParagraphs: '',
    })
    setEditModalOpen(true)
  }

  const events = eventsData?.items || []

  const handleSave = () => {
    if (!form.name || !form.timeRangeStart) {
      alert('请填写名称和开始时间')
      return
    }
    const payload: any = {
      name: form.name,
      timeRange: {
        start: form.timeRangeStart?.toISOString(),
        end: form.timeRangeEnd ? form.timeRangeEnd.toISOString() : null,
        lunarCalendar: form.lunar,
      },
      locationId: form.locationId || undefined,
      summary: form.summary,
      impact: form.impact,
      relatedParagraphs: form.relatedParagraphs
        ? form.relatedParagraphs.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      participants: form.participants,
      type: form.type,
      status: form.status,
    }
    if (editing?.id) {
      payload.id = editing.id
    }
    saveMutation.mutate(payload)
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>事件管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          新建事件
        </Button>
      </Group>

      {/* 筛选器 */}
      <Group mb="md">
        <Select
          placeholder="事件类型"
          data={[{ value: '', label: '全部类型' }, ...eventTypeOptions]}
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
            <Table.Th>名称</Table.Th>
            <Table.Th>时间范围</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>地点</Table.Th>
            <Table.Th>参与者</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ width: 120 }}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center">
                  {isLoading ? '加载中...' : '暂无事件'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            events.map((item: EventItem) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.name}</Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatDate(item.timeRangeStart)}
                    {item.timeRangeEnd ? ` ~ ${formatDate(item.timeRangeEnd)}` : ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge>{formatEventType(item.type)}</Badge>
                </Table.Td>
                <Table.Td>{item.location?.name || '-'}</Table.Td>
                <Table.Td>{item.participants?.length || 0}</Table.Td>
                <Table.Td>
                  <Badge color={item.status === 'PUBLISHED' ? 'green' : 'yellow'}>
                    {item.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      size="sm"
                      onClick={() => {
                        if (confirm(`确定删除事件「${item.name}」吗？`)) {
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
          第 {page} 页 / 共 {eventsData?.totalPages || 1} 页
        </Text>
        <Button
          variant="light"
          onClick={() => setPage(Math.min((eventsData?.totalPages || 1), page + 1))}
          disabled={page >= (eventsData?.totalPages || 1)}
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
        title={editing ? '编辑事件' : '新建事件'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="名称"
            placeholder="请输入事件名称"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Group grow>
            <DateInput
              label="开始时间"
              value={form.timeRangeStart}
              onChange={(value) => setForm((prev) => ({ ...prev, timeRangeStart: value }))}
            />
            <DateInput
              label="结束时间（可选）"
              value={form.timeRangeEnd}
              onChange={(value) => setForm((prev) => ({ ...prev, timeRangeEnd: value }))}
            />
          </Group>
          <Checkbox
            label="农历日期"
            checked={form.lunar}
            onChange={(e) => setForm((prev) => ({ ...prev, lunar: e.currentTarget.checked }))}
          />
          <Group grow>
            <Select
              label="事件类型"
              data={eventTypeOptions}
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
          <Select
            label="地点"
            placeholder="选择地点（可选）"
            data={placeOptions || []}
            value={form.locationId}
            onChange={(v) => setForm((prev) => ({ ...prev, locationId: v || '' }))}
            searchable
            clearable
          />
          <MultiSelect
            label="参与者"
            placeholder="选择参与者（可选）"
            data={personsOptions || []}
            value={form.participants}
            onChange={(v) => setForm((prev) => ({ ...prev, participants: v }))}
            searchable
          />
          <Textarea
            label="摘要"
            minRows={2}
            value={form.summary}
            onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
          />
          <Textarea
            label="影响"
            minRows={2}
            value={form.impact}
            onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))}
          />
          <Textarea
            label="相关段落（用逗号分隔）"
            minRows={2}
            value={form.relatedParagraphs}
            onChange={(e) => setForm((prev) => ({ ...prev, relatedParagraphs: e.target.value }))}
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

export default EventsPage

