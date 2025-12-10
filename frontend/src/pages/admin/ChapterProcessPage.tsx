/**
 * 章节处理页面（事件中心 MVP 版本）
 * 
 * 简化流程：一键提取事件和人物
 */
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
  Progress,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconPlayerPlay, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react'

const typeLabels: Record<string, string> = {
  EVENT: '事件',
  PERSON: '人物',
}

const typeColors: Record<string, string> = {
  EVENT: 'blue',
  PERSON: 'purple',
}

function ChapterProcessPage() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
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

  // 获取待审核的 ReviewItem
  const { data: reviewData } = useQuery({
    queryKey: ['review', 'items', { status: 'PENDING' }],
    queryFn: async () => {
      const response = await api.get('/api/admin/review/items?status=PENDING&pageSize=50')
      return response.data
    },
  })

  // 提取数据（事件中心版本：一次性提取事件和人物）
  const extractMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      const response = await api.post(`/api/admin/chapters/${chapterId}/extract`)
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
    console.log('[ChapterProcess] extract start', { chapterId: selectedChapterId })
    extractMutation.mutate(selectedChapterId)
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

  // 获取选中章节的信息
  const selectedChapter = chapters.find((ch: any) => ch.id === selectedChapterId)

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
                  label: `${chapter.title} (${chapter.paragraphCount || 0} 段${chapter.eventCount ? `, ${chapter.eventCount} 事件` : ''})`,
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
              <Group justify="space-between">
                <div>
                  <Text fw={500}>数据提取</Text>
                  <Text size="sm" c="dimmed">
                    从章节文本中提取历史事件和人物信息
                  </Text>
                </div>
                {extractStatus && (
                  <Badge color={extractStatus.publishedEvents > 0 ? 'green' : 'gray'}>
                    {extractStatus.publishedEvents > 0 
                      ? `已有 ${extractStatus.publishedEvents} 个事件` 
                      : '未提取'}
                  </Badge>
                )}
              </Group>

              {selectedChapter && (
                <Paper p="sm" withBorder bg="gray.0">
                  <Text size="sm" fw={500}>{selectedChapter.title}</Text>
                  <Text size="xs" c="dimmed">
                    {selectedChapter.paragraphCount || 0} 个段落
                    {selectedChapter.timeRangeStart && ` | 时间: ${selectedChapter.timeRangeStart}`}
                  </Text>
                </Paper>
              )}

              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleExtract}
                loading={extractMutation.isPending}
                fullWidth
              >
                开始提取事件和人物
              </Button>

              {extractMutation.isPending && (
                <Alert icon={<Loader size={16} />} color="blue">
                  <Stack gap="xs">
                    <Text size="sm">正在使用 AI 提取数据，请稍候...</Text>
                    <Progress value={100} animated />
                  </Stack>
                </Alert>
              )}

              {extractMutation.data && (
                <Alert icon={<IconCheck size={16} />} color="green">
                  <Text fw={500}>提取完成</Text>
                  <Group gap="lg" mt="xs">
                    <Text size="sm">
                      <Badge color="blue" mr="xs">{extractMutation.data.counts?.event || 0}</Badge>
                      事件
                    </Text>
                    <Text size="sm">
                      <Badge color="purple" mr="xs">{extractMutation.data.counts?.person || 0}</Badge>
                      人物
                    </Text>
                  </Group>
                  {extractMutation.data.meta?.truncatedEvents?.length > 0 && (
                    <Text size="xs" c="dimmed" mt="xs">
                      注：{extractMutation.data.meta.truncatedEvents.length} 个事件因篇幅限制未能详述
                    </Text>
                  )}
                </Alert>
              )}

              {extractMutation.error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red">
                  提取失败: {(extractMutation.error as any)?.response?.data?.error || (extractMutation.error as Error).message}
                </Alert>
              )}
            </Stack>
          </Paper>
        )}

        {/* 待审核列表 */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={500}>待审核数据</Text>
                <Text size="sm" c="dimmed">
                  共 {reviewItems.length} 条待审核
                </Text>
              </div>
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
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>
                      <Checkbox
                        checked={
                          selectedReviewIds.length === reviewItems.length &&
                          reviewItems.length > 0
                        }
                        indeterminate={
                          selectedReviewIds.length > 0 &&
                          selectedReviewIds.length < reviewItems.length
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
                    <Table.Th style={{ width: 80 }}>类型</Table.Th>
                    <Table.Th>内容</Table.Th>
                    <Table.Th style={{ width: 100 }}>时间</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reviewItems.map((item: any) => {
                    const data = item.modifiedData || item.originalData
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
                          <Badge size="sm" color={typeColors[item.type] || 'gray'}>
                            {typeLabels[item.type] || item.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>{data?.name || '未知'}</Text>
                            {item.type === 'EVENT' && data?.summary && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {data.summary}
                              </Text>
                            )}
                            {item.type === 'PERSON' && (
                              <Text size="xs" c="dimmed">
                                {data?.role} | {data?.faction}
                                {data?.aliases?.length > 0 && ` | 别名: ${data.aliases.join(', ')}`}
                              </Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {new Date(item.createdAt).toLocaleString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
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
          </Text>
          {actionModal.action === 'approve' && (
            <Alert color="blue" variant="light">
              通过后将直接发布，数据将对读者可见
            </Alert>
          )}
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
              确认{actionModal.action === 'approve' ? '通过' : '拒绝'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}

export default ChapterProcessPage
