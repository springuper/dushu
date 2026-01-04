/**
 * 事件管理页面（事件中心 MVP 版本）
 * 
 * 事件包含内嵌的 actors JSON 字段和地点字符串字段
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Paper,
  Divider,
  Code,
} from '@mantine/core'
import { IconEdit, IconPlus, IconTrash, IconEye, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { api } from '../../lib/api'

// 事件类型选项
const eventTypeOptions = [
  { value: 'BATTLE', label: '战争' },
  { value: 'POLITICAL', label: '政治' },
  { value: 'PERSONAL', label: '人物事件' },
  { value: 'OTHER', label: '其他' },
]

// 时间精度选项
const timePrecisionOptions = [
  { value: 'EXACT_DATE', label: '精确到日' },
  { value: 'MONTH', label: '精确到月' },
  { value: 'SEASON', label: '精确到季节' },
  { value: 'YEAR', label: '精确到年' },
  { value: 'DECADE', label: '精确到十年' },
  { value: 'APPROXIMATE', label: '大致时间' },
]

// 状态选项
const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

// 参与者角色选项
const actorRoleOptions = [
  { value: 'PROTAGONIST', label: '主角' },
  { value: 'ALLY', label: '同盟' },
  { value: 'OPPOSING', label: '对立方' },
  { value: 'ADVISOR', label: '谋士' },
  { value: 'EXECUTOR', label: '执行者' },
  { value: 'OBSERVER', label: '旁观者' },
  { value: 'OTHER', label: '其他' },
]

interface EventActor {
  personId?: string | null
  name: string
  roleType: string
  description?: string
}

interface EventItem {
  id: string
  name: string
  type: string
  timeRangeStart: string
  timeRangeEnd?: string | null
  timePrecision: string
  locationName?: string | null
  locationModernName?: string | null
  summary: string
  impact?: string | null
  actors: EventActor[]
  chapterId: string
  chapter?: {
    id: string
    title: string
    book?: {
      id: string
      name: string
    }
  }
  relatedParagraphs: string[]
  status: string
}

function EventsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [chapterId, setChapterId] = useState<string>('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [viewing, setViewing] = useState<EventItem | null>(null)
  const [expandedSummary, setExpandedSummary] = useState(false)
  const [expandedImpact, setExpandedImpact] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    type: 'OTHER',
    status: 'DRAFT',
    timeRangeStart: '',
    timeRangeEnd: '',
    timePrecision: 'YEAR',
    locationName: '',
    locationModernName: '',
    summary: '',
    impact: '',
    chapterId: '',
    actors: [] as EventActor[],
    relatedParagraphs: '',
  })

  // 新参与者表单
  const [newActor, setNewActor] = useState({
    name: '',
    roleType: 'OTHER',
    description: '',
  })

  // 获取事件列表
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events', { page, type, status, chapterId }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      if (chapterId) params.append('chapterId', chapterId)
      const res = await api.get(`/api/admin/events?${params.toString()}`)
      return res.data
    },
  })

  // 获取章节列表（用于筛选和选择）
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters', 'all'],
    queryFn: async () => {
      const res = await api.get('/api/admin/chapters?page=1&pageSize=200')
      return res.data?.items || []
    },
  })

  const chapterOptions = (chaptersData || []).map((ch: any) => ({
    value: ch.id,
    label: `${ch.book?.name || ''} - ${ch.title}`,
  }))

  // 删除事件
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/events/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  // 保存事件
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
      timeRangeStart: '',
      timeRangeEnd: '',
      timePrecision: 'YEAR',
      locationName: '',
      locationModernName: '',
      summary: '',
      impact: '',
      chapterId: '',
      actors: [],
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
      timeRangeStart: item.timeRangeStart || '',
      timeRangeEnd: item.timeRangeEnd || '',
      timePrecision: item.timePrecision || 'YEAR',
      locationName: item.locationName || '',
      locationModernName: item.locationModernName || '',
      summary: item.summary || '',
      impact: item.impact || '',
      chapterId: item.chapterId || '',
      actors: item.actors || [],
      relatedParagraphs: (item.relatedParagraphs || []).join(', '),
    })
    setEditModalOpen(true)
  }

  const openDetail = (item: EventItem) => {
    setViewing(item)
    setDetailModalOpen(true)
    setExpandedSummary(false)
    setExpandedImpact(false)
  }

  const handleSave = () => {
    if (!form.name || !form.timeRangeStart || !form.chapterId) {
      alert('请填写名称、开始时间和章节')
      return
    }
    const payload: any = {
      name: form.name,
      type: form.type,
      status: form.status,
      timeRangeStart: form.timeRangeStart,
      timeRangeEnd: form.timeRangeEnd || null,
      timePrecision: form.timePrecision,
      locationName: form.locationName || null,
      locationModernName: form.locationModernName || null,
      summary: form.summary,
      impact: form.impact || null,
      chapterId: form.chapterId,
      actors: form.actors,
      relatedParagraphs: form.relatedParagraphs
        ? form.relatedParagraphs.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    }
    if (editing?.id) {
      payload.id = editing.id
    }
    saveMutation.mutate(payload)
  }

  const addActor = () => {
    if (!newActor.name) {
      alert('请输入参与者姓名')
      return
    }
    setForm((prev) => ({
      ...prev,
      actors: [...prev.actors, { ...newActor, personId: null }],
    }))
    setNewActor({ name: '', roleType: 'OTHER', description: '' })
  }

  const removeActor = (index: number) => {
    setForm((prev) => ({
      ...prev,
      actors: prev.actors.filter((_, i) => i !== index),
    }))
  }

  const events = eventsData?.items || []

  const formatEventType = (value: string) => {
    const item = eventTypeOptions.find((o) => o.value === value)
    return item?.label || value
  }

  const formatActorRole = (value: string) => {
    const item = actorRoleOptions.find((o) => o.value === value)
    return item?.label || value
  }

  // 判断内容是否需要展开（超过约150字符或包含换行）
  const needsExpand = (text: string | null | undefined) => {
    if (!text) return false
    return text.length > 150 || text.includes('\n')
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
          clearable
        />
        <Select
          placeholder="状态"
          data={[{ value: '', label: '全部状态' }, ...statusOptions]}
          value={status}
          onChange={(v) => setStatus(v || '')}
          clearable
        />
        <Select
          placeholder="章节"
          data={[{ value: '', label: '全部章节' }, ...chapterOptions]}
          value={chapterId}
          onChange={(v) => setChapterId(v || '')}
          clearable
          searchable
          style={{ minWidth: 200 }}
        />
      </Group>

      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>名称</Table.Th>
            <Table.Th>时间</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>地点</Table.Th>
            <Table.Th>参与者</Table.Th>
            <Table.Th>章节</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ width: 150 }}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed" ta="center">
                  {isLoading ? '加载中...' : '暂无事件'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            events.map((item: EventItem) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{item.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.timeRangeStart}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{formatEventType(item.type)}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.locationName || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{(item.actors || []).length} 人</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {item.chapter?.book?.name} - {item.chapter?.title}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={item.status === 'PUBLISHED' ? 'green' : 'yellow'} size="sm">
                    {item.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => openDetail(item)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
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
          第 {page} 页 / 共 {eventsData?.totalPages || 1} 页
        </Text>
        <Button
          variant="light"
          size="sm"
          onClick={() => setPage(Math.min((eventsData?.totalPages || 1), page + 1))}
          disabled={page >= (eventsData?.totalPages || 1)}
        >
          下一页
        </Button>
      </Group>

      {/* 编辑/新建弹窗 */}
      <Modal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditing(null)
        }}
        title={editing ? '编辑事件' : '新建事件'}
        size="xl"
      >
        <Stack gap="md">
          <TextInput
            label="名称"
            placeholder="请输入事件名称"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          
          <Group grow>
            <TextInput
              label="开始时间"
              placeholder="如：前206年、前206年冬"
              value={form.timeRangeStart}
              onChange={(e) => setForm((prev) => ({ ...prev, timeRangeStart: e.target.value }))}
              required
            />
            <TextInput
              label="结束时间（可选）"
              placeholder="如：前202年"
              value={form.timeRangeEnd}
              onChange={(e) => setForm((prev) => ({ ...prev, timeRangeEnd: e.target.value }))}
            />
            <Select
              label="时间精度"
              data={timePrecisionOptions}
              value={form.timePrecision}
              onChange={(v) => setForm((prev) => ({ ...prev, timePrecision: v || 'YEAR' }))}
            />
          </Group>

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
            label="章节"
            placeholder="选择章节"
            data={chapterOptions}
            value={form.chapterId}
            onChange={(v) => setForm((prev) => ({ ...prev, chapterId: v || '' }))}
            searchable
            required
          />

          <Group grow>
            <TextInput
              label="地点（历史名）"
              placeholder="如：鸿门"
              value={form.locationName}
              onChange={(e) => setForm((prev) => ({ ...prev, locationName: e.target.value }))}
            />
            <TextInput
              label="地点（现代名）"
              placeholder="如：陕西省西安市临潼区"
              value={form.locationModernName}
              onChange={(e) => setForm((prev) => ({ ...prev, locationModernName: e.target.value }))}
            />
          </Group>

          <Divider label="参与者" labelPosition="center" />
          
          {/* 现有参与者列表 */}
          {form.actors.length > 0 && (
            <Stack gap="xs">
              {form.actors.map((actor, index) => (
                <Paper key={index} p="xs" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{actor.name}</Text>
                      <Text size="xs" c="dimmed">
                        {formatActorRole(actor.roleType)}
                        {actor.description && ` - ${actor.description.slice(0, 50)}...`}
                      </Text>
                    </div>
                    <ActionIcon
                      color="red"
                      variant="light"
                      size="sm"
                      onClick={() => removeActor(index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}

          {/* 添加新参与者 */}
          <Paper p="sm" withBorder bg="gray.0">
            <Text size="sm" fw={500} mb="xs">添加参与者</Text>
            <Group align="flex-end">
              <TextInput
                label="姓名"
                placeholder="人物姓名"
                value={newActor.name}
                onChange={(e) => setNewActor((prev) => ({ ...prev, name: e.target.value }))}
                style={{ flex: 1 }}
              />
              <Select
                label="角色"
                data={actorRoleOptions}
                value={newActor.roleType}
                onChange={(v) => setNewActor((prev) => ({ ...prev, roleType: v || 'OTHER' }))}
                style={{ width: 120 }}
              />
              <TextInput
                label="描述（可选）"
                placeholder="此人在事件中的表现"
                value={newActor.description}
                onChange={(e) => setNewActor((prev) => ({ ...prev, description: e.target.value }))}
                style={{ flex: 2 }}
              />
              <Button variant="light" onClick={addActor}>添加</Button>
            </Group>
          </Paper>

          <Textarea
            label="摘要"
            placeholder="事件摘要（200-400字）"
            minRows={3}
            value={form.summary}
            onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
            required
          />
          
          <Textarea
            label="影响（可选）"
            placeholder="事件的历史影响"
            minRows={2}
            value={form.impact}
            onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))}
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

      {/* 详情弹窗 */}
      <Modal
        opened={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setViewing(null)
        }}
        title="事件详情"
        size="lg"
      >
        {viewing && (
          <Stack gap="md">
            <Group>
              <Text fw={500}>名称：</Text>
              <Text>{viewing.name}</Text>
            </Group>
            <Group>
              <Text fw={500}>时间：</Text>
              <Text>
                {viewing.timeRangeStart}
                {viewing.timeRangeEnd && ` ~ ${viewing.timeRangeEnd}`}
              </Text>
            </Group>
            <Group>
              <Text fw={500}>类型：</Text>
              <Badge>{formatEventType(viewing.type)}</Badge>
            </Group>
            {viewing.locationName && (
              <Group>
                <Text fw={500}>地点：</Text>
                <Text>
                  {viewing.locationName}
                  {viewing.locationModernName && ` (${viewing.locationModernName})`}
                </Text>
              </Group>
            )}
            <Group>
              <Text fw={500}>章节：</Text>
              <Text>{viewing.chapter?.book?.name} - {viewing.chapter?.title}</Text>
            </Group>
            
            <Divider label="摘要" labelPosition="left" />
            <Stack gap="xs">
              <Text 
                size="sm" 
                style={{ 
                  lineClamp: expandedSummary ? undefined : 3,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {viewing.summary}
              </Text>
              {needsExpand(viewing.summary) && (
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
            
            {viewing.impact && (
              <>
                <Divider label="影响" labelPosition="left" />
                <Stack gap="xs">
                  <Text 
                    size="sm" 
                    style={{ 
                      lineClamp: expandedImpact ? undefined : 3,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {viewing.impact}
                  </Text>
                  {needsExpand(viewing.impact) && (
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
            
            <Divider label={`参与者 (${(viewing.actors || []).length})`} labelPosition="left" />
            <Stack gap="xs">
              {(viewing.actors || []).map((actor, index) => (
                <Paper key={index} p="xs" withBorder>
                  <Group>
                    <Badge size="sm" variant="light">{formatActorRole(actor.roleType)}</Badge>
                    <Text size="sm" fw={500}>{actor.name}</Text>
                  </Group>
                  {actor.description && (
                    <Text size="xs" c="dimmed" mt={4}>{actor.description}</Text>
                  )}
                </Paper>
              ))}
            </Stack>

            <Divider label="原始数据" labelPosition="left" />
            <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(viewing, null, 2)}
            </Code>
          </Stack>
        )}
      </Modal>
    </Container>
  )
}

export default EventsPage
