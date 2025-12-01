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
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'

function PersonsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editModal, setEditModal] = useState<string | null>(null)

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

      {/* 列表 */}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
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
              <Table.Td colSpan={6} ta="center">
                加载中...
              </Table.Td>
            </Table.Tr>
          ) : data?.items.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6} ta="center">
                暂无数据
              </Table.Td>
            </Table.Tr>
          ) : (
            data?.items.map((person: any) => (
              <Table.Tr key={person.id}>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {person.id.substring(0, 8)}...
                  </Text>
                </Table.Td>
                <Table.Td>{person.name}</Table.Td>
                <Table.Td>{person.role}</Table.Td>
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
            data={[
              { value: 'EMPEROR', label: '皇帝' },
              { value: 'GENERAL', label: '将军' },
              { value: 'MINISTER', label: '大臣' },
              { value: 'SCHOLAR', label: '学者' },
              { value: 'OTHER', label: '其他' },
            ]}
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

