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
  NumberInput,
} from '@mantine/core'
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { api } from '../../lib/api'

const placeTypeOptions = [
  { value: 'CITY', label: '城池' },
  { value: 'BATTLEFIELD', label: '战场' },
  { value: 'RIVER', label: '河流' },
  { value: 'MOUNTAIN', label: '山脉' },
  { value: 'REGION', label: '地区' },
  { value: 'OTHER', label: '其他' },
]

const factionOptions = [
  { value: 'HAN', label: '汉' },
  { value: 'CHU', label: '楚' },
  { value: 'NEUTRAL', label: '中立' },
  { value: 'OTHER', label: '其他' },
]

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

type PlaceItem = {
  id: string
  name: string
  modernName?: string | null
  type: string
  faction?: string | null
  status: string
  coordinatesLng?: number | null
  coordinatesLat?: number | null
  description?: string | null
}

function PlacesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlaceItem | null>(null)
  const [form, setForm] = useState({
    name: '',
    modernName: '',
    type: 'OTHER',
    faction: '',
    status: 'DRAFT',
    coordinatesLng: 0,
    coordinatesLat: 0,
    description: '',
  })

  const { data: placesData, isLoading } = useQuery({
    queryKey: ['places', { page, type, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      if (search) params.append('search', search)
      const res = await api.get(`/api/admin/places?${params.toString()}`)
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/places/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places'] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...data } = payload
        return api.put(`/api/admin/places/${id}`, data)
      }
      return api.post('/api/admin/places', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places'] })
      setEditModalOpen(false)
      setEditing(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      modernName: '',
      type: 'OTHER',
      faction: '',
      status: 'DRAFT',
      coordinatesLng: 0,
      coordinatesLat: 0,
      description: '',
    })
    setEditModalOpen(true)
  }

  const openEdit = (item: PlaceItem) => {
    setEditing(item)
    setForm({
      name: item.name || '',
      modernName: item.modernName || '',
      type: item.type || 'OTHER',
      faction: item.faction || '',
      status: item.status || 'DRAFT',
      coordinatesLng: item.coordinatesLng || 0,
      coordinatesLat: item.coordinatesLat || 0,
      description: item.description || '',
    })
    setEditModalOpen(true)
  }

  const handleSave = () => {
    if (!form.name) {
      alert('请填写名称')
      return
    }
    const payload: any = {
      name: form.name,
      modernName: form.modernName,
      type: form.type,
      faction: form.faction || undefined,
      status: form.status,
      coordinates: {
        lng: form.coordinatesLng,
        lat: form.coordinatesLat,
      },
      description: form.description,
    }
    if (editing?.id) {
      payload.id = editing.id
    }
    saveMutation.mutate(payload)
  }

  const places = placesData?.items || []

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>地点管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          新建地点
        </Button>
      </Group>

      <Group mb="md">
        <TextInput
          placeholder="搜索名称/现代名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          placeholder="类型"
          data={[{ value: '', label: '全部类型' }, ...placeTypeOptions]}
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
            <Table.Th>现代名</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>势力</Table.Th>
            <Table.Th>坐标</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ width: 120 }}>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {places.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center">
                  {isLoading ? '加载中...' : '暂无地点'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            places.map((item: PlaceItem) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.name}</Table.Td>
                <Table.Td>{item.modernName || '-'}</Table.Td>
                <Table.Td>
                  <Badge>
                    {placeTypeOptions.find((o) => o.value === item.type)?.label || item.type}
                  </Badge>
                </Table.Td>
                <Table.Td>{factionOptions.find((o) => o.value === item.faction)?.label || '-'}</Table.Td>
                <Table.Td>
                  {item.coordinatesLng && item.coordinatesLat
                    ? `${item.coordinatesLng.toFixed(3)}, ${item.coordinatesLat.toFixed(3)}`
                    : '-'}
                </Table.Td>
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
                        if (confirm(`确定删除地点「${item.name}」吗？`)) {
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
          第 {page} 页 / 共 {placesData?.totalPages || 1} 页
        </Text>
        <Button
          variant="light"
          onClick={() => setPage(Math.min((placesData?.totalPages || 1), page + 1))}
          disabled={page >= (placesData?.totalPages || 1)}
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
        title={editing ? '编辑地点' : '新建地点'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="名称"
            placeholder="请输入历史名称"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextInput
            label="现代名称（可选）"
            placeholder="如 江苏省徐州市沛县"
            value={form.modernName}
            onChange={(e) => setForm((prev) => ({ ...prev, modernName: e.target.value }))}
          />
          <Group grow>
            <NumberInput
              label="经度"
              value={form.coordinatesLng}
              onChange={(value) => setForm((prev) => ({ ...prev, coordinatesLng: Number(value) || 0 }))}
              decimalScale={6}
              thousandSeparator=","
            />
            <NumberInput
              label="纬度"
              value={form.coordinatesLat}
              onChange={(value) => setForm((prev) => ({ ...prev, coordinatesLat: Number(value) || 0 }))}
              decimalScale={6}
              thousandSeparator=","
            />
          </Group>
          <Group grow>
            <Select
              label="类型"
              data={placeTypeOptions}
              value={form.type}
              onChange={(v) => setForm((prev) => ({ ...prev, type: v || 'OTHER' }))}
            />
            <Select
              label="势力"
              data={factionOptions}
              value={form.faction}
              onChange={(v) => setForm((prev) => ({ ...prev, faction: v || '' }))}
              clearable
            />
            <Select
              label="状态"
              data={statusOptions}
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: v || 'DRAFT' }))}
            />
          </Group>
          <Textarea
            label="描述"
            minRows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
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

export default PlacesPage

