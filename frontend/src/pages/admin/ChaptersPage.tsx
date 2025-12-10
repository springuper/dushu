import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Text,
  Select,
  FileButton,
  Stack,
  Alert,
  Table,
  Badge,
  Code,
  Tabs,
} from '@mantine/core'
import { api } from '../../lib/api'
import { IconUpload, IconAlertCircle, IconCheck, IconBook } from '@tabler/icons-react'

function ChaptersPage() {
  const [file, setFile] = useState<File | null>(null)
  const [bookId, setBookId] = useState<string | null>(null)
  const [preview, setPreview] = useState<any>(null)

  // 获取书籍列表
  const { data: booksData } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const response = await api.get('/api/admin/books')
      return response.data
    },
  })

  const books = booksData || []

  // 导入章节
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post('/api/admin/chapters/import', formData)
      return response.data
    },
    onSuccess: () => {
      setFile(null)
      setPreview(null)
      setBookId(null)
    },
  })

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return

    setFile(selectedFile)

    // 预览文件内容
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string)
        setPreview({
          title: content.title,
          source: content.source,
          paragraphCount: content.paragraphs?.length || 0,
          sample: content.paragraphs?.[0] || content,
        })
      } catch (error) {
        setPreview({ error: 'JSON 格式错误' })
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = () => {
    if (!file || !bookId) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bookId', bookId)

    importMutation.mutate(formData)
  }

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">章节管理</Title>

      <Tabs defaultValue="import">
        <Tabs.List>
          <Tabs.Tab value="import" leftSection={<IconUpload size={16} />}>
            导入章节
          </Tabs.Tab>
          <Tabs.Tab value="list" leftSection={<IconBook size={16} />}>
            章节列表
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="import" pt="md">
          <Stack gap="lg">
            {/* 上传区域 */}
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Select
                  label="选择书籍"
                  data={books.map((book: any) => ({
                    value: book.id,
                    label: `${book.name}${book.nameEn ? ` (${book.nameEn})` : ''}`,
                  }))}
                  value={bookId}
                  onChange={setBookId}
                  placeholder="选择要导入到的书籍"
                  required
                  searchable
                />

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    选择章节 JSON 文件
                  </Text>
                  <Group>
                    <FileButton
                      onChange={handleFileSelect}
                      accept="application/json"
                    >
                      {(props) => (
                        <Button {...props} leftSection={<IconUpload size={16} />}>
                          选择 JSON 文件
                        </Button>
                      )}
                    </FileButton>
                    {file && (
                      <Text size="sm" c="dimmed">
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </Text>
                    )}
                  </Group>
                </div>

                {preview && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      文件预览
                    </Text>
                    {preview.error ? (
                      <Alert icon={<IconAlertCircle size={16} />} color="red">
                        {preview.error}
                      </Alert>
                    ) : (
                      <Paper p="sm" withBorder>
                        <Stack gap="xs">
                          <Text size="sm">
                            <strong>章节标题：</strong>
                            {preview.title || '未指定'}
                          </Text>
                          {preview.source && (
                            <Text size="sm">
                              <strong>来源：</strong>
                              {preview.source.book} - {preview.source.chapter}
                            </Text>
                          )}
                          <Text size="sm">
                            <strong>段落数：</strong>
                            {preview.paragraphCount}
                          </Text>
                          <div>
                            <Text size="sm" fw={500} mb="xs">
                              第一段示例：
                            </Text>
                            <Code block style={{ maxHeight: 150, overflow: 'auto' }}>
                              {typeof preview.sample === 'object'
                                ? preview.sample.text || JSON.stringify(preview.sample, null, 2)
                                : preview.sample}
                            </Code>
                          </div>
                        </Stack>
                      </Paper>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={!file || !bookId || !!preview?.error}
                  loading={importMutation.isPending}
                  leftSection={<IconUpload size={16} />}
                >
                  开始导入
                </Button>
              </Stack>
            </Paper>

            {/* 导入结果 */}
            {importMutation.data && (
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group>
                    <IconCheck size={20} color="green" />
                    <Text fw={500}>导入完成</Text>
                  </Group>

                  <Table>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>章节 ID</Table.Td>
                        <Table.Td>
                          <Code>{importMutation.data.chapter.id}</Code>
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>章节标题</Table.Td>
                        <Table.Td>{importMutation.data.chapter.title}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>段落数</Table.Td>
                        <Table.Td>
                          <Badge color="green">{importMutation.data.paragraphCount}</Badge>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>
            )}

            {importMutation.error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {importMutation.error?.response?.data?.error || importMutation.error.message}
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="list" pt="md">
          <ChapterList />
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}

// 章节列表组件
function ChapterList() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)

  const { data: booksData } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const response = await api.get('/api/admin/books')
      return response.data
    },
  })

  const { data: chaptersData, refetch } = useQuery({
    queryKey: ['chapters', selectedBookId],
    queryFn: async () => {
      const params = selectedBookId ? { bookId: selectedBookId } : {}
      const response = await api.get('/api/admin/chapters', { params })
      return response.data
    },
  })

  const books = booksData || []
  const chapters = chaptersData?.items || []

  return (
    <Stack gap="md">
      <Select
        label="筛选书籍"
        data={[
          { value: '', label: '全部书籍' },
          ...books.map((book: any) => ({
            value: book.id,
            label: `${book.name}${book.nameEn ? ` (${book.nameEn})` : ''}`,
          })),
        ]}
        value={selectedBookId || ''}
        onChange={(value) => setSelectedBookId(value || null)}
        placeholder="选择书籍"
        clearable
        searchable
      />

      <Paper p="md" withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>章节标题</Table.Th>
              <Table.Th>所属书籍</Table.Th>
              <Table.Th>顺序</Table.Th>
              <Table.Th>段落数</Table.Th>
              <Table.Th>时间范围</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {chapters.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  <Text c="dimmed">暂无章节</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              chapters.map((chapter: any) => (
                <Table.Tr key={chapter.id}>
                  <Table.Td>{chapter.title}</Table.Td>
                  <Table.Td>
                    {chapter.book?.name || '未知'}
                  </Table.Td>
                  <Table.Td>{chapter.order}</Table.Td>
                  <Table.Td>
                    <Badge>{chapter.paragraphCount || 0}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {chapter.timeRangeStart || chapter.timeRangeEnd ? (
                      <Text size="sm">
                        {chapter.timeRangeStart || '?'} - {chapter.timeRangeEnd || '?'}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  )
}

export default ChaptersPage

