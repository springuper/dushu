import { useState } from 'react'
import * as React from 'react'
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
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'

// 角色枚举值到中文的映射
const roleMap: Record<string, string> = {
  MONARCH: '君主',
  ADVISOR: '谋士',
  GENERAL: '将军',
  CIVIL_OFFICIAL: '文臣',
  MILITARY_OFFICIAL: '武将',
  RELATIVE: '外戚',
  EUNUCH: '宦官',
  OTHER: '其他',
  // 兼容旧的枚举值
  EMPEROR: '君主',
  EMPRESS: '君主',
  WARLORD: '将军',
  MINISTER: '谋士',
  SCHOLAR: '文臣',
}

// 中文到枚举值的反向映射（用于编辑表单）
const roleReverseMap: Record<string, string> = {
  '君主': 'MONARCH',
  '谋士': 'ADVISOR',
  '将军': 'GENERAL',
  '文臣': 'CIVIL_OFFICIAL',
  '武将': 'MILITARY_OFFICIAL',
  '外戚': 'RELATIVE',
  '宦官': 'EUNUCH',
  '其他': 'OTHER',
}

// 获取角色的中文显示
function getRoleLabel(role: string): string {
  return roleMap[role] || role
}

// 获取所有可用的角色选项（用于编辑表单）
function getRoleOptions() {
  return [
    { value: 'MONARCH', label: '君主' },
    { value: 'ADVISOR', label: '谋士' },
    { value: 'GENERAL', label: '将军' },
    { value: 'CIVIL_OFFICIAL', label: '文臣' },
    { value: 'MILITARY_OFFICIAL', label: '武将' },
    { value: 'RELATIVE', label: '外戚' },
    { value: 'EUNUCH', label: '宦官' },
    { value: 'OTHER', label: '其他' },
  ]
}

function PersonsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editModal, setEditModal] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['persons', { search, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (status) params.append('status', status)
      params.append('page', page.toString())

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
          data={[
            { value: '', label: '全部状态' },
            { value: 'DRAFT', label: '草稿' },
            { value: 'PUBLISHED', label: '已发布' },
          ]}
          value={status}
          onChange={(value) => setStatus(value || '')}
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
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={data && data.items.length > 0 && selectedIds.size === data.items.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < (data?.items.length || 0)}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
              />
            </Table.Th>
            <Table.Th>ID</Table.Th>
            <Table.Th>名称</Table.Th>
            <Table.Th>角色</Table.Th>
            <Table.Th>状态</Table.Th>
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
            data?.items.map((person: any) => (
              <Table.Tr key={person.id}>
                <Table.Td>
                  <Checkbox
                    checked={selectedIds.has(person.id)}
                    onChange={(e) => handleSelectOne(person.id, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {person.id.substring(0, 8)}...
                  </Text>
                </Table.Td>
                <Table.Td>{person.name}</Table.Td>
                <Table.Td>{getRoleLabel(person.role)}</Table.Td>
                <Table.Td>
                  <Badge color={person.status === 'PUBLISHED' ? 'green' : 'gray'}>
                    {person.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(person.createdAt).toLocaleString('zh-CN')}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setEditModal(person.id)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        if (confirm('确定要删除吗？')) {
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
      {data && data.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button
            variant="subtle"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            上一页
          </Button>
          <Text>
            第 {page} 页，共 {data.totalPages} 页
          </Text>
          <Button
            variant="subtle"
            onClick={() => setPage(page + 1)}
            disabled={page === data.totalPages}
          >
            下一页
          </Button>
        </Group>
      )}

      {/* 编辑 Modal */}
      <PersonEditModal
        personId={editModal}
        onClose={() => setEditModal(null)}
      />
    </Container>
  )
}

// 人物编辑 Modal
function PersonEditModal({ personId, onClose }: { personId: string | null; onClose: () => void }) {
  const [formData, setFormData] = useState<any>({
    name: '',
    biography: '',
    role: 'OTHER',
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
      if (personId === 'new') {
        const response = await api.post('/api/admin/persons', data)
        return response.data
      } else {
        const response = await api.put(`/api/admin/persons/${personId}`, data)
        return response.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
      onClose()
    },
  })

  // 使用 useEffect 加载现有数据
  React.useEffect(() => {
    if (person && !isLoading) {
      setFormData({
        name: person.name || '',
        biography: person.biography || '',
        role: person.role || 'OTHER',
        status: person.status || 'DRAFT',
      })
    } else if (personId === 'new') {
      setFormData({
        name: '',
        biography: '',
        role: 'OTHER',
        status: 'DRAFT',
      })
    }
  }, [person, isLoading, personId])

  const handleSave = () => {
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
        <Stack>
          <TextInput
            label="名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label="传记"
            value={formData.biography}
            onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
            minRows={5}
            required
          />
          <Select
            label="角色"
            data={getRoleOptions()}
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value || 'OTHER' })}
          />
          <Select
            label="状态"
            data={[
              { value: 'DRAFT', label: '草稿' },
              { value: 'PUBLISHED', label: '已发布' },
            ]}
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value || 'DRAFT' })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
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

export default PersonsPage

