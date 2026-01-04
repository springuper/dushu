/**
 * 地点管理页面
 * 
 * 展示和管理地点知识库中的所有地点
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
  Checkbox,
} from '@mantine/core'
import { IconEdit, IconPlus, IconTrash, IconEye } from '@tabler/icons-react'
import { api } from '../../lib/api'

// 来源选项
const sourceOptions = [
  { value: 'CHGIS', label: 'CHGIS' },
  { value: 'LLM', label: 'LLM' },
  { value: 'HYBRID', label: '混合' },
  { value: 'MANUAL', label: '手动录入' },
]

// 状态选项
const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已发布' },
]

interface PlaceItem {
  id: string
  name: string
  aliases: string[]
  coordinatesLng: number | null
  coordinatesLat: number | null
  modernLocation: string | null
  modernAddress: string | null
  adminLevel1: string | null
  adminLevel2: string | null
  adminLevel3: string | null
  geographicContext: string | null
  featureType: string | null
  source: string
  chgisId: string | null
  sourceChapterIds: string[]
  timeRangeBegin: string | null
  timeRangeEnd: string | null
  status: string
}

function PlacesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [source, setSource] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlaceItem | null>(null)
  const [viewing, setViewing] = useState<PlaceItem | null>(null)
  
  const [form, setForm] = useState({
    name: '',
    aliases: '',
    coordinatesLng: '',
    coordinatesLat: '',
    modernLocation: '',
    modernAddress: '',
    adminLevel1: '',
    adminLevel2: '',
    adminLevel3: '',
    geographicContext: '',
    featureType: '',
    source: 'MANUAL',
    chgisId: '',
    timeRangeBegin: '',
    timeRangeEnd: '',
    status: 'DRAFT',
  })

  // 获取地点列表
  const { data: placesData, isLoading } = useQuery({
    queryKey: ['places', { page, source, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', '20')
      if (source) params.append('source', source)
      if (status) params.append('status', status)
      if (search) params.append('search', search)
      const res = await api.get(`/api/admin/places?${params.toString()}`)
      return res.data
    },
  })

  // 删除地点
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/places/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places'] })
    },
  })

  // 保存地点
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
      aliases: '',
      coordinatesLng: '',
      coordinatesLat: '',
      modernLocation: '',
      modernAddress: '',
      adminLevel1: '',
      adminLevel2: '',
      adminLevel3: '',
      geographicContext: '',
      featureType: '',
      source: 'MANUAL',
      chgisId: '',
      timeRangeBegin: '',
      timeRangeEnd: '',
      status: 'DRAFT',
    })
    setEditModalOpen(true)
  }

  const openEdit = (item: PlaceItem) => {
    setEditing(item)
    setForm({
      name: item.name || '',
      aliases: (item.aliases || []).join(', '),
      coordinatesLng: item.coordinatesLng?.toString() || '',
      coordinatesLat: item.coordinatesLat?.toString() || '',
      modernLocation: item.modernLocation || '',
      modernAddress: item.modernAddress || '',
      adminLevel1: item.adminLevel1 || '',
      adminLevel2: item.adminLevel2 || '',
      adminLevel3: item.adminLevel3 || '',
      geographicContext: item.geographicContext || '',
      featureType: item.featureType || '',
      source: item.source || 'MANUAL',
      chgisId: item.chgisId || '',
      timeRangeBegin: item.timeRangeBegin || '',
      timeRangeEnd: item.timeRangeEnd || '',
      status: item.status || 'DRAFT',
    })
    setEditModalOpen(true)
  }

  const openDetail = (item: PlaceItem) => {
    setViewing(item)
    setDetailModalOpen(true)
  }

  const handleSave = () => {
    if (!form.name) {
      alert('请填写地点名称')
      return
    }
    const payload: any = {
      name: form.name,
      aliases: form.aliases ? form.aliases.split(',').map(s => s.trim()).filter(Boolean) : [],
      coordinatesLng: form.coordinatesLng ? parseFloat(form.coordinatesLng) : null,
      coordinatesLat: form.coordinatesLat ? parseFloat(form.coordinatesLat) : null,
      modernLocation: form.modernLocation || null,
      modernAddress: form.modernAddress || null,
      adminLevel1: form.adminLevel1 || null,
      adminLevel2: form.adminLevel2 || null,
      adminLevel3: form.adminLevel3 || null,
      geographicContext: form.geographicContext || null,
      featureType: form.featureType || null,
      source: form.source,
      chgisId: form.chgisId || null,
      timeRangeBegin: form.timeRangeBegin || null,
      timeRangeEnd: form.timeRangeEnd || null,
      status: form.status,
    }
    if (editing?.id) {
      payload.id = editing.id
    }
    saveMutation.mutate(payload)
  }

  const places = placesData?.items || []

  const formatSource = (value: string) => {
    const item = sourceOptions.find((o) => o.value === value)
    return item?.label || value
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>地点管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          新建地点
        </Button>
      </Group>

      {/* 筛选器 */}
      <Group mb="md">
        <TextInput
          placeholder="搜索地点名称、别名、现代位置..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="来源"
          data={[{ value: '', label: '全部来源' }, ...sourceOptions]}
          value={source}
          onChange={(v) => setSource(v || '')}
          clearable
        />
        <Select
          placeholder="状态"
          data={[{ value: '', label: '全部状态' }, ...statusOptions]}
          value={status}
          onChange={(v) => setStatus(v || '')}
          clearable
        />
      </Group>

      {/* 地点列表 */}
      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>名称</Table.Th>
            <Table.Th>现代位置</Table.Th>
            <Table.Th>坐标</Table.Th>
            <Table.Th>来源</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                <Text>加载中...</Text>
              </Table.Td>
            </Table.Tr>
          ) : places.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                <Text c="dimmed">暂无地点</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            places.map((place: PlaceItem) => (
              <Table.Tr key={place.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text fw={500}>{place.name}</Text>
                    {place.aliases && place.aliases.length > 0 && (
                      <Text size="xs" c="dimmed">
                        别名: {place.aliases.join(', ')}
                      </Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {place.modernLocation || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {place.coordinatesLng && place.coordinatesLat ? (
                    <Text size="sm">
                      {place.coordinatesLng.toFixed(4)}, {place.coordinatesLat.toFixed(4)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {formatSource(place.source)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={place.status === 'PUBLISHED' ? 'green' : 'gray'}>
                    {place.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => openDetail(place)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="orange"
                      onClick={() => openEdit(place)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        if (confirm('确定要删除这个地点吗？')) {
                          deleteMutation.mutate(place.id)
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
      {placesData && placesData.totalPages > 1 && (
        <Group justify="center" mt="xl">
          <Button
            variant="light"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <Text>
            第 {page} 页，共 {placesData.totalPages} 页（共 {placesData.total} 条）
          </Text>
          <Button
            variant="light"
            onClick={() => setPage((p) => Math.min(placesData.totalPages, p + 1))}
            disabled={page === placesData.totalPages}
          >
            下一页
          </Button>
        </Group>
      )}

      {/* 编辑/创建弹窗 */}
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
            label="地点名称 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <TextInput
            label="别名（逗号分隔）"
            value={form.aliases}
            onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            placeholder="别名1, 别名2"
          />
          <Group grow>
            <TextInput
              label="经度"
              type="number"
              value={form.coordinatesLng}
              onChange={(e) => setForm({ ...form, coordinatesLng: e.target.value })}
              placeholder="116.92695"
            />
            <TextInput
              label="纬度"
              type="number"
              value={form.coordinatesLat}
              onChange={(e) => setForm({ ...form, coordinatesLat: e.target.value })}
              placeholder="34.73800"
            />
          </Group>
          <Textarea
            label="现代位置"
            value={form.modernLocation}
            onChange={(e) => setForm({ ...form, modernLocation: e.target.value })}
            placeholder="陕西省西安市临潼区骊山北麓"
            rows={2}
          />
          <TextInput
            label="可搜索地址"
            value={form.modernAddress}
            onChange={(e) => setForm({ ...form, modernAddress: e.target.value })}
            placeholder="鸿门宴遗址"
          />
          <Group grow>
            <TextInput
              label="一级行政隶属"
              value={form.adminLevel1}
              onChange={(e) => setForm({ ...form, adminLevel1: e.target.value })}
              placeholder="骊邑附近区域"
            />
            <TextInput
              label="二级行政隶属"
              value={form.adminLevel2}
              onChange={(e) => setForm({ ...form, adminLevel2: e.target.value })}
              placeholder="内史"
            />
            <TextInput
              label="三级行政隶属"
              value={form.adminLevel3}
              onChange={(e) => setForm({ ...form, adminLevel3: e.target.value })}
              placeholder="秦朝"
            />
          </Group>
          <Textarea
            label="地理背景"
            value={form.geographicContext}
            onChange={(e) => setForm({ ...form, geographicContext: e.target.value })}
            placeholder="地理背景描述（100-200字）"
            rows={4}
          />
          <Group grow>
            <TextInput
              label="地点类型"
              value={form.featureType}
              onChange={(e) => setForm({ ...form, featureType: e.target.value })}
              placeholder="地名/军事节点"
            />
            <Select
              label="来源"
              data={sourceOptions}
              value={form.source}
              onChange={(v) => setForm({ ...form, source: v || 'MANUAL' })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="CHGIS ID"
              value={form.chgisId}
              onChange={(e) => setForm({ ...form, chgisId: e.target.value })}
            />
            <TextInput
              label="时间范围开始"
              value={form.timeRangeBegin}
              onChange={(e) => setForm({ ...form, timeRangeBegin: e.target.value })}
              placeholder="-223"
            />
            <TextInput
              label="时间范围结束"
              value={form.timeRangeEnd}
              onChange={(e) => setForm({ ...form, timeRangeEnd: e.target.value })}
              placeholder="1264"
            />
          </Group>
          <Group grow>
            <Select
              label="状态"
              data={statusOptions}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v || 'DRAFT' })}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setEditModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saveMutation.isPending}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="地点详情"
        size="lg"
      >
        {viewing ? (
          <Stack gap="md">
            <Paper p="md" withBorder>
              <Text size="lg" fw={500} mb="xs">{viewing.name}</Text>
              {viewing.aliases && viewing.aliases.length > 0 && (
                <Text size="sm" c="dimmed" mb="sm">别名: {viewing.aliases.join(', ')}</Text>
              )}
              <Group gap="xs" mb="sm">
                <Badge size="sm">{formatSource(viewing.source)}</Badge>
                <Badge size="sm" color={viewing.status === 'PUBLISHED' ? 'green' : 'gray'}>
                  {viewing.status === 'PUBLISHED' ? '已发布' : '草稿'}
                </Badge>
              </Group>
              {viewing.coordinatesLng && viewing.coordinatesLat && (
                <Text size="sm" mb="sm">
                  坐标: {viewing.coordinatesLng.toFixed(4)}, {viewing.coordinatesLat.toFixed(4)}
                </Text>
              )}
              {viewing.modernLocation && (
                <>
                  <Divider label="现代位置" labelPosition="left" mb="sm" />
                  <Text size="sm">{viewing.modernLocation}</Text>
                  {viewing.modernAddress && (
                    <Text size="xs" c="dimmed" mt="xs">可搜索地址: {viewing.modernAddress}</Text>
                  )}
                </>
              )}
              {(viewing.adminLevel1 || viewing.adminLevel2 || viewing.adminLevel3) && (
                <>
                  <Divider label="历史行政隶属" labelPosition="left" my="sm" />
                  <Stack gap="xs">
                    {viewing.adminLevel1 && <Text size="sm">一级: {viewing.adminLevel1}</Text>}
                    {viewing.adminLevel2 && <Text size="sm">二级: {viewing.adminLevel2}</Text>}
                    {viewing.adminLevel3 && <Text size="sm">三级: {viewing.adminLevel3}</Text>}
                  </Stack>
                </>
              )}
              {viewing.geographicContext && (
                <>
                  <Divider label="地理背景" labelPosition="left" my="sm" />
                  <Text size="sm">{viewing.geographicContext}</Text>
                </>
              )}
              {viewing.featureType && (
                <Text size="sm" mt="sm">地点类型: {viewing.featureType}</Text>
              )}
              {(viewing.timeRangeBegin || viewing.timeRangeEnd) && (
                <Text size="xs" c="dimmed" mt="sm">
                  时间范围: {viewing.timeRangeBegin || '?'} ~ {viewing.timeRangeEnd || '?'}
                </Text>
              )}
            </Paper>
          </Stack>
        ) : null}
      </Modal>
    </Container>
  )
}

export default PlacesPage

