import { useParams, useNavigate } from 'react-router-dom'
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Loader, Alert, Breadcrumbs, Anchor } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getBookById } from '../lib/api'

function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()

  const { data: book, isLoading, error } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookById(bookId!),
    enabled: !!bookId,
    retry: 1,
  })

  const handleChapterClick = (chapterId: string) => {
    navigate(`/reading/${chapterId}`)
  }

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center" py="xl">
          <Loader size="md" />
          <Text c="dimmed">加载中...</Text>
        </Group>
      </Container>
    )
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" title="加载失败">
          {error instanceof Error ? error.message : '无法加载书籍信息，请稍后重试'}
        </Alert>
      </Container>
    )
  }

  if (!book) {
    return (
      <Container size="lg" py="xl">
        <Alert color="blue" title="书籍不存在">
          未找到指定的书籍
        </Alert>
      </Container>
    )
  }

  const breadcrumbs = [
    { title: '首页', href: '/' },
    { title: book.name, href: '#' },
  ].map((item, index) => (
    <Anchor
      key={index}
      href={item.href}
      onClick={(e) => {
        e.preventDefault()
        if (item.href !== '#') {
          navigate(item.href)
        }
      }}
    >
      {item.title}
    </Anchor>
  ))

  return (
    <Container size="lg" py="xl">
      <Breadcrumbs mb="md">{breadcrumbs}</Breadcrumbs>

      {/* 书籍信息 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Stack gap="md">
          <Title order={1}>{book.name}</Title>

          <Group gap="md">
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

            <Badge color="blue" variant="light">
              {book.chapterCount || 0} 章节
            </Badge>
          </Group>

          {book.description && (
            <Text size="sm" c="dimmed" mt="xs">
              {book.description}
            </Text>
          )}
        </Stack>
      </Card>

      {/* 章节列表 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">
          章节列表
        </Title>

        {!book.chapters || book.chapters.length === 0 ? (
          <Alert color="blue" title="暂无章节">
            <Text size="sm">该书籍还没有章节内容</Text>
          </Alert>
        ) : (
          <Stack gap="sm">
            {book.chapters.map((chapter: any) => (
              <Card
                key={chapter.id}
                shadow="xs"
                padding="md"
                radius="md"
                withBorder
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.boxShadow = ''
                }}
                onClick={() => handleChapterClick(chapter.id)}
              >
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm">
                      <Badge size="sm" variant="outline">
                        第 {chapter.order} 章
                      </Badge>
                      <Title order={4} style={{ margin: 0 }}>
                        {chapter.title}
                      </Title>
                    </Group>

                    {chapter.timeRangeStart && (
                      <Text size="xs" c="dimmed">
                        时间范围：{chapter.timeRangeStart}
                        {chapter.timeRangeEnd && ` - ${chapter.timeRangeEnd}`}
                      </Text>
                    )}

                    {chapter.totalParagraphs > 0 && (
                      <Text size="xs" c="dimmed">
                        {chapter.totalParagraphs} 段落
                      </Text>
                    )}
                  </Stack>

                  <Button size="sm" variant="light">
                    阅读
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Card>
    </Container>
  )
}

export default BookDetailPage

