import { Container, Title, Text, Card, Badge, Button, Grid, Group, Stack, Loader, Alert } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { healthCheck, getPublishedBooks } from '../lib/api'

interface Book {
  id: string
  name: string
  nameEn?: string
  author?: string
  dynasty?: string
  writtenYear?: string
  description?: string
  chapterCount: number
  status: string
}

function HomePage() {
  const navigate = useNavigate()
  
  const { data: healthData, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
    retry: 1,
    retryDelay: 1000,
  })

  const { data: books, isLoading: booksLoading, error: booksError } = useQuery<Book[]>({
    queryKey: ['publishedBooks'],
    queryFn: getPublishedBooks,
    retry: 1,
    retryDelay: 1000,
    enabled: !!healthData, // 只有在健康检查通过后才获取书籍
  })

  const handleBookClick = (book: Book) => {
    // 跳转到书籍详情页，使用书籍ID
    navigate(`/book/${book.id}`)
  }

  return (
    <Container size="lg" py="xl">
      <Title order={1}>历史阅读增强 App</Title>
      <Text size="lg" mt="md" mb="xl">
        欢迎使用历史阅读增强 App
      </Text>

      {/* 系统状态卡片 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Title order={3} mb="md">
          系统状态
        </Title>

        <div style={{ marginBottom: '1rem' }}>
          <Text fw={500} mb="xs">
            后端 API 连接：
          </Text>
          {healthLoading && <Badge color="blue">检查中...</Badge>}
          {healthError && (
            <div>
              <Badge color="red" mb="xs">连接失败</Badge>
              <Text size="xs" c="red" mt="xs">
                {healthError instanceof Error 
                  ? healthError.message 
                  : (healthError as any)?.response?.data?.error || '无法连接到后端服务器'}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                请确保后端服务器运行在 http://localhost:3001
              </Text>
            </div>
          )}
          {healthData && (
            <Badge color="green">
              ✅ 连接正常 - {healthData.status}
            </Badge>
          )}
        </div>

        {healthData && (
          <div style={{ marginBottom: '1rem' }}>
            <Text size="sm" c="dimmed">
              服务器时间: {new Date(healthData.timestamp).toLocaleString('zh-CN')}
            </Text>
          </div>
        )}

        <Button onClick={() => refetchHealth()} variant="light" size="sm">
          重新检查
        </Button>
      </Card>

      {/* 已发布书籍列表 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">
          已发布书籍
        </Title>

        {booksLoading && (
          <Group justify="center" py="xl">
            <Loader size="md" />
            <Text c="dimmed">加载中...</Text>
          </Group>
        )}

        {booksError && (
          <Alert color="red" title="加载失败">
            {booksError instanceof Error 
              ? booksError.message 
              : '无法加载书籍列表，请稍后重试'}
          </Alert>
        )}

        {!booksLoading && !booksError && books && books.length === 0 && (
          <Alert color="blue" title="暂无已发布书籍">
            <Text size="sm">
              目前还没有已发布的书籍，请等待管理员发布。
            </Text>
          </Alert>
        )}

        {!booksLoading && !booksError && books && books.length > 0 && (
          <Grid gutter="md">
            {books.map((book) => (
              <Grid.Col key={book.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{ 
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = ''
                  }}
                  onClick={() => handleBookClick(book)}
                >
                  <Stack gap="sm">
                    <Title order={4}>{book.name}</Title>
                    
                    {book.author && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>作者：</Text>
                        <Text size="sm" c="dimmed">{book.author}</Text>
                      </Group>
                    )}

                    {book.dynasty && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>朝代：</Text>
                        <Text size="sm" c="dimmed">{book.dynasty}</Text>
                      </Group>
                    )}

                    {book.writtenYear && (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>成书年代：</Text>
                        <Text size="sm" c="dimmed">{book.writtenYear}</Text>
                      </Group>
                    )}

                    {book.description && (
                      <Text size="sm" c="dimmed" lineClamp={3}>
                        {book.description}
                      </Text>
                    )}

                    <Group justify="space-between" mt="auto">
                      <Badge color="blue" variant="light">
                        {book.chapterCount} 章节
                      </Badge>
                      <Button size="xs" variant="light">
                        开始阅读
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Card>

      {/* 快速导航 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
        <Title order={3} mb="md">
          快速导航
        </Title>
        <Button
          component="a"
          href="/admin/login"
          variant="outline"
          size="sm"
        >
          管理后台
        </Button>
      </Card>
    </Container>
  )
}

export default HomePage

