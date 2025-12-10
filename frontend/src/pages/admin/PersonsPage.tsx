/**
 * 人物管理页面（事件中心 MVP 版本）
 * 
 * 人物不再有独立的关系表，关系通过事件推断
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Container,
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Select,
  ActionIcon,
  Badge,
  Modal,
  Stack,
  Textarea,
  Text,
  Checkbox,
  Paper,
  Divider,
  Code,
  Tabs,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconEdit, IconTrash, IconPlus, IconEye } from '@tabler/icons-react'

// 角色选项
const roleOptions = [
  { value: 'MONARCH', label: '君主' },
  { value: 'ADVISOR', label: '谋士' },
  { value: 'GENERAL', label: '将领' },
  { value: 'CIVIL_OFFICIAL', label: '文臣' },
  { value: 'MILITARY_OFFICIAL', label: '武将' },
  { value: 'RELATIVE', label: '外戚' },
  { value: 'EUNUCH', label: '宦官' },
  { value: 'OTHER', label: '其他' },
]

// 阵营选项
const factionOptions = [
  { value: 'HAN', label: '汉' },
  { value: 'CHU', label: '楚' },
  { value: 'NEUTRAL', label: '中立' },
  { value: 'OTHER', label: '其他' },
]

// 状态选项
const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

// 角色映射
const roleMap: Record<string, string> = {
  MONARCH: '君主',
  ADVISOR: '谋士',
  GENERAL: '将领',
  CIVIL_OFFICIAL: '文臣',
  MILITARY_OFFICIAL: '武将',
  RELATIVE: '外戚',
  EUNUCH: '宦官',
  OTHER: '其他',
}

// 阵营映射
const factionMap: Record<string, string> = {
  HAN: '汉',
  CHU: '楚',
  NEUTRAL: '中立',
  OTHER: '其他',
}

function PersonsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [faction, setFaction] = useState('')
  const [page, setPage] = useState(1)
  const [editModal, setEditModal] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['persons', { search, status, faction, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (status) params.append('status', status)
      if (faction) params.append('faction', faction)
      params.append('page', page.toString())
      params.append('pageSize', '20')

      const response = await api.get(`/api/admin/persons?${params.toString()}`)
      return response.data
    },
  })

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/persons/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
    },
  })

  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await api.post('/api/admin/persons/batch/status', { ids, status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      setSelectedIds(new Set())
    },
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data?.items.map((p: any) => p.id) || [])
      setSelectedIds(allIds)
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBatchStatusChange = (newStatus: string) => {
    if (selectedIds.size === 0) {
      alert('请先选择要操作的人物')
      return
    }
    if (confirm(`确定要将选中的 ${selectedIds.size} 个人物状态改为"${newStatus === 'PUBLISHED' ? '已发布' : '草稿'}"吗？`)) {
      batchStatusMutation.mutate({
        ids: Array.from(selectedIds),
        status: newStatus,
      })
    }
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>人物管理</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditModal('new')}
        >
          新建人物
        </Button>
      </Group>

      {/* 筛选器 */}
      <Group mb="md">
        <TextInput
          placeholder="搜索名称"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="阵营"
          data={[{ value: '', label: '全部阵营' }, ...factionOptions]}
          value={faction}
          onChange={(value) => setFaction(value || '')}
          clearable
        />
        <Select
          placeholder="状态"
          data={[{ value: '', label: '全部状态' }, ...statusOptions]}
          value={status}
          onChange={(value) => setStatus(value || '')}
          clearable
        />
      </Group>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <Group mb="md" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)', borderRadius: 'var(--mantine-radius-md)' }}>
          <Text size="sm" fw={500}>
            已选择 {selectedIds.size} 项
          </Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => handleBatchStatusChange('PUBLISHED')}
            loading={batchStatusMutation.isPending}
          >
            批量发布
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => handleBatchStatusChange('DRAFT')}
            loading={batchStatusMutation.isPending}
          >
            批量设为草稿
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setSelectedIds(new Set())}
          >
            取消选择
          </Button>
        </Group>
      )}

      {/* 列表 */}
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={data && data.items.length > 0 && selectedIds.size === data.items.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < (data?.items.length || 0)}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
              />
            </Table.Th>
            <Table.Th>名称</Table.Th>
            <Table.Th>别名</Table.Th>
            <Table.Th>角色</Table.Th>
            <Table.Th>阵营</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ width: 150 }}>操作</Table.Th>
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
            data?.items.map((person: any) => (
              <Table.Tr key={person.id}>
                <Table.Td>
                  <Checkbox
                    checked={selectedIds.has(person.id)}
                    onChange={(e) => handleSelectOne(person.id, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{person.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {(person.aliases || []).join(', ') || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{roleMap[person.role] || person.role}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={person.faction === 'HAN' ? 'red' : person.faction === 'CHU' ? 'blue' : 'gray'}>
                    {factionMap[person.faction] || person.faction}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={person.status === 'PUBLISHED' ? 'green' : 'yellow'} size="sm">
                    {person.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => setDetailModal(person.id)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => setEditModal(person.id)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      onClick={() => {
                        if (confirm(`确定要删除人物「${person.name}」吗？`)) {
                          deleteMutation.mutate(person.id)
                        }
                      }}
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

      {/* 编辑 Modal */}
      <PersonEditModal
        personId={editModal}
        onClose={() => setEditModal(null)}
      />

      {/* 详情 Modal */}
      <PersonDetailModal
        personId={detailModal}
        onClose={() => setDetailModal(null)}
      />
    </Container>
  )
}

// 人物编辑 Modal
function PersonEditModal({ personId, onClose }: { personId: string | null; onClose: () => void }) {
  const [formData, setFormData] = useState<any>({
    name: '',
    aliases: '',
    biography: '',
    role: 'OTHER',
    faction: 'OTHER',
    birthYear: '',
    deathYear: '',
    status: 'DRAFT',
  })

  const { data: person, isLoading } = useQuery({
    queryKey: ['person', personId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/persons/${personId}`)
      return response.data
    },
    enabled: !!personId && personId !== 'new',
  })

  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // 处理别名
      const aliases = data.aliases
        ? data.aliases.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
      
      const payload = {
        ...data,
        aliases,
      }

      if (personId === 'new') {
        const response = await api.post('/api/admin/persons', payload)
        return response.data
      } else {
        const response = await api.put(`/api/admin/persons/${personId}`, payload)
        return response.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      onClose()
    },
  })

  useEffect(() => {
    if (person && !isLoading) {
      setFormData({
        name: person.name || '',
        aliases: (person.aliases || []).join(', '),
        biography: person.biography || '',
        role: person.role || 'OTHER',
        faction: person.faction || 'OTHER',
        birthYear: person.birthYear || '',
        deathYear: person.deathYear || '',
        status: person.status || 'DRAFT',
      })
    } else if (personId === 'new') {
      setFormData({
        name: '',
        aliases: '',
        biography: '',
        role: 'OTHER',
        faction: 'OTHER',
        birthYear: '',
        deathYear: '',
        status: 'DRAFT',
      })
    }
  }, [person, isLoading, personId])

  const handleSave = () => {
    if (!formData.name || !formData.biography) {
      alert('请填写名称和传记')
      return
    }
    saveMutation.mutate(formData)
  }

  return (
    <Modal
      opened={!!personId}
      onClose={onClose}
      title={personId === 'new' ? '新建人物' : '编辑人物'}
      size="lg"
    >
      {isLoading && personId !== 'new' ? (
        <Text>加载中...</Text>
      ) : (
        <Stack gap="md">
          <TextInput
            label="名称"
            placeholder="人物姓名"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextInput
            label="别名（用逗号分隔）"
            placeholder="如：高祖, 沛公, 汉王"
            value={formData.aliases}
            onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
          />
          <Group grow>
            <Select
              label="角色"
              data={roleOptions}
              value={formData.role}
              onChange={(value) => setFormData({ ...formData, role: value || 'OTHER' })}
            />
            <Select
              label="阵营"
              data={factionOptions}
              value={formData.faction}
              onChange={(value) => setFormData({ ...formData, faction: value || 'OTHER' })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="出生年份"
              placeholder="如：前256年"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
            />
            <TextInput
              label="去世年份"
              placeholder="如：前195年"
              value={formData.deathYear}
              onChange={(e) => setFormData({ ...formData, deathYear: e.target.value })}
            />
          </Group>
          <Textarea
            label="传记"
            placeholder="人物简介（200-400字）"
            value={formData.biography}
            onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
            minRows={5}
            required
          />
          <Select
            label="状态"
            data={statusOptions}
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value || 'DRAFT' })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saveMutation.isPending}>
              保存
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

// 人物详情 Modal（包含参与的事件）
function PersonDetailModal({ personId, onClose }: { personId: string | null; onClose: () => void }) {
  const { data: person, isLoading } = useQuery({
    queryKey: ['person', personId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/persons/${personId}`)
      return response.data
    },
    enabled: !!personId,
  })

  const { data: events } = useQuery({
    queryKey: ['person-events', personId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/persons/${personId}/events`)
      return response.data
    },
    enabled: !!personId,
  })

  return (
    <Modal
      opened={!!personId}
      onClose={onClose}
      title="人物详情"
      size="xl"
    >
      {isLoading ? (
        <Text>加载中...</Text>
      ) : person ? (
        <Tabs defaultValue="info">
          <Tabs.List>
            <Tabs.Tab value="info">基本信息</Tabs.Tab>
            <Tabs.Tab value="events">参与事件 ({(events || []).length})</Tabs.Tab>
            <Tabs.Tab value="raw">原始数据</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="info" pt="md">
            <Stack gap="md">
              <Group>
                <Text fw={500}>名称：</Text>
                <Text>{person.name}</Text>
              </Group>
              {person.aliases?.length > 0 && (
                <Group>
                  <Text fw={500}>别名：</Text>
                  <Text>{person.aliases.join(', ')}</Text>
                </Group>
              )}
              <Group>
                <Text fw={500}>角色：</Text>
                <Badge>{roleMap[person.role] || person.role}</Badge>
              </Group>
              <Group>
                <Text fw={500}>阵营：</Text>
                <Badge variant="light">{factionMap[person.faction] || person.faction}</Badge>
              </Group>
              {(person.birthYear || person.deathYear) && (
                <Group>
                  <Text fw={500}>生卒：</Text>
                  <Text>{person.birthYear || '?'} ~ {person.deathYear || '?'}</Text>
                </Group>
              )}
              <Divider label="传记" labelPosition="left" />
              <Text size="sm">{person.biography}</Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="events" pt="md">
            {(events || []).length === 0 ? (
              <Text c="dimmed" ta="center">暂无参与的事件</Text>
            ) : (
              <Stack gap="sm">
                {(events || []).map((event: any) => (
                  <Paper key={event.id} p="sm" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{event.name}</Text>
                        <Text size="xs" c="dimmed">
                          {event.timeRangeStart} | {event.chapter?.book?.name} - {event.chapter?.title}
                        </Text>
                      </div>
                      <Badge size="sm">{event.type}</Badge>
                    </Group>
                    <Text size="xs" mt="xs" lineClamp={2}>{event.summary}</Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="raw" pt="md">
            <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(person, null, 2)}
            </Code>
          </Tabs.Panel>
        </Tabs>
      ) : null}
    </Modal>
  )
}

export default PersonsPage
