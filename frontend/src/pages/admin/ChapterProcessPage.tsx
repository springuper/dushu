import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Container,
  Title,
  Table,
  Button,
  Group,
  Select,
  Stack,
  Text,
  Paper,
  Badge,
  Alert,
  Checkbox,
  Modal,
  Textarea,
  Loader,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconPlayerPlay, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react'

function ChapterProcessPage() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [extractTypes, setExtractTypes] = useState<string[]>(['person', 'relationship', 'place', 'event'])
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([])
  const [actionModal, setActionModal] = useState<{
    open: boolean
    action: 'approve' | 'reject' | null
    ids: string[]
  }>({ open: false, action: null, ids: [] })

  const queryClient = useQueryClient()

  // 获取书籍列表
  const { data: booksData } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const response = await api.get('/api/admin/books')
      return response.data
    },
  })

  // 获取章节列表
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters', selectedBookId],
    queryFn: async () => {
      const params = selectedBookId ? { bookId: selectedBookId } : {}
      const response = await api.get('/api/admin/chapters', { params })
      return response.data
    },
    enabled: !!selectedBookId,
  })

  // 获取章节提取状态
  const { data: extractStatus } = useQuery({
    queryKey: ['chapter-extract-status', selectedChapterId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/chapters/${selectedChapterId}/extract-status`)
      return response.data
    },
    enabled: !!selectedChapterId,
  })

  // 获取待审核的 ReviewItem（按章节筛选）
  const { data: reviewData } = useQuery({
    queryKey: ['review', 'items', { status: 'PENDING' }],
    queryFn: async () => {
      const response = await api.get('/api/admin/review/items?status=PENDING')
      return response.data
    },
  })

  // 提取数据
  const extractMutation = useMutation({
    mutationFn: async ({ chapterId, types }: { chapterId: string; types: string[] }) => {
      const response = await api.post(`/api/admin/chapters/${chapterId}/extract`, { types })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      queryClient.invalidateQueries({ queryKey: ['chapter-extract-status'] })
    },
  })

  // 批量审核
  const batchApproveMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const response = await api.post('/api/admin/review/batch-approve', { ids, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      setActionModal({ open: false, action: null, ids: [] })
      setSelectedReviewIds([])
    },
  })

  const batchRejectMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const response = await api.post('/api/admin/review/batch-reject', { ids, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      setActionModal({ open: false, action: null, ids: [] })
      setSelectedReviewIds([])
    },
  })

  const handleExtract = () => {
    if (!selectedChapterId) return
    console.log('[ChapterProcess] extract start', {
      chapterId: selectedChapterId,
      types: extractTypes,
    })
    extractMutation.mutate({
      chapterId: selectedChapterId,
      types: extractTypes,
    })
  }

  const handleBatchAction = (action: 'approve' | 'reject') => {
    if (selectedReviewIds.length === 0) return
    setActionModal({ open: true, action, ids: selectedReviewIds })
  }

  const handleConfirmAction = (notes?: string) => {
    if (actionModal.action === 'approve' && actionModal.ids.length > 0) {
      batchApproveMutation.mutate({ ids: actionModal.ids, notes })
    } else if (actionModal.action === 'reject' && actionModal.ids.length > 0) {
      batchRejectMutation.mutate({ ids: actionModal.ids, notes })
    }
  }

  const books = booksData || []
  const chapters = chaptersData?.items || []
  const reviewItems = reviewData?.items || []

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">章节处理</Title>

      <Stack gap="lg">
        {/* 选择书籍和章节 */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Select
              label="选择书籍"
              data={books.map((book: any) => ({
                value: book.id,
                label: `${book.name}${book.nameEn ? ` (${book.nameEn})` : ''}`,
              }))}
              value={selectedBookId}
              onChange={(value) => {
                setSelectedBookId(value)
                setSelectedChapterId(null)
              }}
              placeholder="选择书籍"
              searchable
              clearable
            />

            {selectedBookId && (
              <Select
                label="选择章节"
                data={chapters.map((chapter: any) => ({
                  value: chapter.id,
                  label: `${chapter.title} (${chapter.paragraphCount || 0} 段)`,
                }))}
                value={selectedChapterId}
                onChange={setSelectedChapterId}
                placeholder="选择章节"
                searchable
              />
            )}
          </Stack>
        </Paper>

        {/* 提取操作 */}
        {selectedChapterId && (
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Text fw={500}>数据提取</Text>
              
              <Group>
                <Checkbox
                  label="人物"
                  checked={extractTypes.includes('person')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExtractTypes([...extractTypes, 'person'])
                    } else {
                      setExtractTypes(extractTypes.filter((t) => t !== 'person'))
                    }
                  }}
                />
                <Checkbox
                  label="关系"
                  checked={extractTypes.includes('relationship')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExtractTypes([...extractTypes, 'relationship'])
                    } else {
                      setExtractTypes(extractTypes.filter((t) => t !== 'relationship'))
                    }
                  }}
                />
                <Checkbox
                  label="地点"
                  checked={extractTypes.includes('place')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExtractTypes([...extractTypes, 'place'])
                    } else {
                      setExtractTypes(extractTypes.filter((t) => t !== 'place'))
                    }
                  }}
                />
                <Checkbox
                  label="事件"
                  checked={extractTypes.includes('event')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExtractTypes([...extractTypes, 'event'])
                    } else {
                      setExtractTypes(extractTypes.filter((t) => t !== 'event'))
                    }
                  }}
                />
              </Group>

              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleExtract}
                loading={extractMutation.isPending}
                disabled={extractTypes.length === 0}
              >
                开始提取
              </Button>

              {extractMutation.isPending && (
                <Alert icon={<Loader size={16} />} color="blue">
                  正在提取数据，请稍候...
                </Alert>
              )}

              {extractMutation.data && (
                <Alert icon={<IconCheck size={16} />} color="green">
                  <Text fw={500}>提取完成</Text>
                  <Text size="sm">
                    人物: {extractMutation.data.counts.person} | 关系:{' '}
                    {extractMutation.data.counts.relationship} | 地点:{' '}
                    {extractMutation.data.counts.place} | 事件:{' '}
                    {extractMutation.data.counts.event}
                  </Text>
                  {console.log('[ChapterProcess] extract success', extractMutation.data)}
                </Alert>
              )}

              {extractMutation.error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red">
                  {extractMutation.error?.response?.data?.error || extractMutation.error.message}
                  {console.error('[ChapterProcess] extract error', extractMutation.error)}
                </Alert>
              )}
            </Stack>
          </Paper>
        )}

        {/* 待审核列表 */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>待审核数据</Text>
              <Group>
                <Button
                  variant="light"
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => handleBatchAction('approve')}
                  disabled={selectedReviewIds.length === 0}
                  loading={batchApproveMutation.isPending}
                >
                  批量通过 ({selectedReviewIds.length})
                </Button>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconX size={16} />}
                  onClick={() => handleBatchAction('reject')}
                  disabled={selectedReviewIds.length === 0}
                  loading={batchRejectMutation.isPending}
                >
                  批量拒绝 ({selectedReviewIds.length})
                </Button>
              </Group>
            </Group>

            {reviewItems.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                暂无待审核数据
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>
                      <Checkbox
                        checked={
                          selectedReviewIds.length === reviewItems.length &&
                          reviewItems.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReviewIds(reviewItems.map((item: any) => item.id))
                          } else {
                            setSelectedReviewIds([])
                          }
                        }}
                      />
                    </Table.Th>
                    <Table.Th>类型</Table.Th>
                    <Table.Th>数据</Table.Th>
                    <Table.Th>状态</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reviewItems.map((item: any) => {
                    const data = item.modifiedData || item.originalData
                    const name = data?.name || data?.sourceId || '未知'
                    return (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedReviewIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReviewIds([...selectedReviewIds, item.id])
                              } else {
                                setSelectedReviewIds(
                                  selectedReviewIds.filter((id) => id !== item.id)
                                )
                              }
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Badge>
                            {item.type === 'PERSON'
                              ? '人物'
                              : item.type === 'RELATIONSHIP'
                              ? '关系'
                              : item.type === 'PLACE'
                              ? '地点'
                              : '事件'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={item.status === 'PENDING' ? 'yellow' : 'gray'}>
                            {item.status === 'PENDING'
                              ? '待审核'
                              : item.status === 'APPROVED'
                              ? '已通过'
                              : item.status === 'REJECTED'
                              ? '已拒绝'
                              : '已修改'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>
      </Stack>

      {/* 批量操作确认模态框 */}
      <Modal
        opened={actionModal.open}
        onClose={() => setActionModal({ open: false, action: null, ids: [] })}
        title={actionModal.action === 'approve' ? '批量通过审核' : '批量拒绝'}
      >
        <Stack gap="md">
          <Text>
            确定要{actionModal.action === 'approve' ? '通过' : '拒绝'}{' '}
            {actionModal.ids.length} 条数据吗？
            {actionModal.action === 'approve' && (
              <Text size="sm" c="dimmed" mt="xs">
                通过后将直接发布（状态设为 PUBLISHED）
              </Text>
            )}
          </Text>
          <Textarea
            label="备注（可选）"
            placeholder="输入审核备注..."
            minRows={3}
            id="batch-action-notes"
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
                const notesInput = document.getElementById(
                  'batch-action-notes'
                ) as HTMLTextAreaElement
                handleConfirmAction(notesInput?.value || undefined)
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

export default ChapterProcessPage

