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

// 状态枚举值到中文的映射
const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已审核',
  PUBLISHED: '已发布',
  REJECTED: '已拒绝',
}

// 状态选项
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已审核' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'REJECTED', label: '已拒绝' },
]

function BooksPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editModal, setEditModal] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['books', { search, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (status) params.append('status', status)

      const response = await api.get(`/api/admin/books?${params.toString()}`)
      return response.data
    },
  })

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/books/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定要删除书籍"${name}"吗？此操作不可恢复。`)) {
      deleteMutation.mutate(id)
    }
  }

  const books = data || []

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>书籍管理</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditModal('new')}
        >
          新建书籍
        </Button>
      </Group>

      {/* 搜索和筛选 */}
      <Group mb="md">
        <TextInput
          placeholder="搜索书籍名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="筛选状态"
          data={statusOptions}
          value={status}
          onChange={(value) => setStatus(value || '')}
          clearable
          style={{ width: 150 }}
        />
      </Group>

      {/* 书籍列表 */}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>书名</Table.Th>
            <Table.Th>英文名</Table.Th>
            <Table.Th>作者</Table.Th>
            <Table.Th>朝代</Table.Th>
            <Table.Th>章节数</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                <Text c="dimmed">加载中...</Text>
              </Table.Td>
            </Table.Tr>
          ) : books.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                <Text c="dimmed">暂无书籍</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            books.map((book: any) => (
              <Table.Tr key={book.id}>
                <Table.Td>{book.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {book.nameEn || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>{book.author || '-'}</Table.Td>
                <Table.Td>{book.dynasty || '-'}</Table.Td>
                <Table.Td>
                  <Badge>{book.chapterCount || 0}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      book.status === 'PUBLISHED'
                        ? 'green'
                        : book.status === 'REJECTED'
                        ? 'red'
                        : 'gray'
                    }
                  >
                    {statusMap[book.status] || book.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => setEditModal(book.id)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(book.id, book.name)}
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

      {/* 编辑/新建模态框 */}
      {editModal && (
        <BookEditModal
          bookId={editModal === 'new' ? null : editModal}
          onClose={() => {
            setEditModal(null)
            queryClient.invalidateQueries({ queryKey: ['books'] })
          }}
        />
      )}
    </Container>
  )
}

// 书籍编辑/新建模态框
function BookEditModal({
  bookId,
  onClose,
}: {
  bookId: string | null
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    author: '',
    dynasty: '',
    writtenYear: '',
    description: '',
    sourceUrl: '',
    status: 'DRAFT' as string,
  })

  const queryClient = useQueryClient()

  // 如果是编辑模式，加载书籍数据
  const { data: bookData, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: async () => {
      // 使用 ID 路由，因为 bookId 是 UUID
      const response = await api.get(`/api/admin/books/id/${bookId}`)
      return response.data
    },
    enabled: !!bookId && bookId !== 'new',
  })

  // 当数据加载完成后，填充表单
  React.useEffect(() => {
    if (bookData) {
      setFormData({
        name: bookData.name || '',
        nameEn: bookData.nameEn || '',
        author: bookData.author || '',
        dynasty: bookData.dynasty || '',
        writtenYear: bookData.writtenYear || '',
        description: bookData.description || '',
        sourceUrl: bookData.sourceUrl || '',
        status: bookData.status || 'DRAFT',
      })
    }
  }, [bookData])

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (bookId && bookId !== 'new') {
        // 更新
        const response = await api.put(`/api/admin/books/${bookId}`, data)
        return response.data
      } else {
        // 创建
        const response = await api.post('/api/admin/books', data)
        return response.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={bookId && bookId !== 'new' ? '编辑书籍' : '新建书籍'}
      size="lg"
    >
      {isLoading ? (
        <Text>加载中...</Text>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="书名"
              placeholder="如：史记"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />

            <TextInput
              label="英文名/拼音"
              placeholder="如：shiji"
              value={formData.nameEn}
              onChange={(e) =>
                setFormData({ ...formData, nameEn: e.target.value })
              }
              description="用于 URL 和标识，如果不填会自动生成"
            />

            <Group grow>
              <TextInput
                label="作者"
                placeholder="如：司马迁"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
              />

              <TextInput
                label="朝代"
                placeholder="如：西汉"
                value={formData.dynasty}
                onChange={(e) =>
                  setFormData({ ...formData, dynasty: e.target.value })
                }
              />
            </Group>

            <TextInput
              label="成书年代"
              placeholder="如：公元前91年"
              value={formData.writtenYear}
              onChange={(e) =>
                setFormData({ ...formData, writtenYear: e.target.value })
              }
            />

            <Textarea
              label="简介"
              placeholder="书籍简介..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              minRows={3}
            />

            <TextInput
              label="来源链接"
              placeholder="如：https://zh.wikisource.org/wiki/..."
              value={formData.sourceUrl}
              onChange={(e) =>
                setFormData({ ...formData, sourceUrl: e.target.value })
              }
            />

            <Select
              label="状态"
              data={statusOptions.filter((opt) => opt.value !== '')}
              value={formData.status}
              onChange={(value) =>
                setFormData({ ...formData, status: value || 'DRAFT' })
              }
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                保存
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  )
}

export default BooksPage

