import { useParams, useNavigate } from 'react-router-dom'
import { Container, Title, Text, Card, Group, Button, Stack, Loader, Alert, Breadcrumbs, Anchor, Paper, Popover } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getChapterById } from '../lib/api'
import { useState } from 'react'

interface Paragraph {
  id: string
  order: number
  text: string
  annotations: Annotation[]
}

interface Annotation {
  id: string
  targetText: string
  explanation: string
  position: number
}

interface Chapter {
  id: string
  title: string
  summary: string
  order: number
  book: {
    id: string
    name: string
  }
  paragraphs: Paragraph[]
}

function ReadingPage() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{ annotation: Annotation; paragraphId: string } | null>(null)

  const { data: chapter, isLoading, error } = useQuery<Chapter>({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapterById(chapterId!),
    enabled: !!chapterId,
    retry: 1,
  })

  // 将段落文本与注释合并显示
  const renderParagraphWithAnnotations = (paragraph: Paragraph) => {
    if (!paragraph.annotations || paragraph.annotations.length === 0) {
      return <Text>{paragraph.text}</Text>
    }

    // 按位置排序注释
    const sortedAnnotations = [...paragraph.annotations].sort((a, b) => a.position - b.position)
    
    let result: (string | JSX.Element)[] = []
    let lastIndex = 0

    sortedAnnotations.forEach((annotation, idx) => {
      // 添加注释前的文本
      if (annotation.position > lastIndex) {
        result.push(paragraph.text.substring(lastIndex, annotation.position))
      }

      // 添加注释标记
      const annotationText = paragraph.text.substring(
        annotation.position,
        annotation.position + annotation.targetText.length
      )
      
      result.push(
        <Popover
          key={`ann-${annotation.id}`}
          width={300}
          position="top"
          withArrow
          shadow="md"
          onOpen={() => setHoveredAnnotation({ annotation, paragraphId: paragraph.id })}
          onClose={() => setHoveredAnnotation(null)}
        >
          <Popover.Target>
            <Text
              component="span"
              style={{
                cursor: 'help',
                borderBottom: '1px dotted #666',
                color: '#0066cc',
              }}
            >
              {annotationText}
            </Text>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="sm">{annotation.explanation}</Text>
          </Popover.Dropdown>
        </Popover>
      )

      lastIndex = annotation.position + annotation.targetText.length
    })

    // 添加最后剩余的文本
    if (lastIndex < paragraph.text.length) {
      result.push(paragraph.text.substring(lastIndex))
    }

    return <Text>{result}</Text>
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
          {error instanceof Error ? error.message : '无法加载章节内容，请稍后重试'}
        </Alert>
      </Container>
    )
  }

  if (!chapter) {
    return (
      <Container size="lg" py="xl">
        <Alert color="blue" title="章节不存在">
          未找到指定的章节
        </Alert>
      </Container>
    )
  }

  const breadcrumbs = [
    { title: '首页', href: '/' },
    { title: chapter.book.name, href: `/book/${chapter.book.id}` },
    { title: chapter.title, href: '#' },
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

      <Group justify="space-between" mb="md">
        <Button variant="subtle" onClick={() => navigate(`/book/${chapter.book.id}`)}>
          ← 返回书籍
        </Button>
      </Group>

      <Card shadow="sm" padding="xl" radius="md" withBorder>
        <Stack gap="xl">
          <div>
            <Title order={1} mb="sm">{chapter.title}</Title>
            {chapter.summary && (
              <Text size="sm" c="dimmed" mb="md">
                {chapter.summary}
              </Text>
            )}
          </div>

          {!chapter.paragraphs || chapter.paragraphs.length === 0 ? (
            <Alert color="blue" title="暂无内容">
              <Text size="sm">该章节还没有段落内容</Text>
            </Alert>
          ) : (
            <Stack gap="lg">
              {chapter.paragraphs.map((paragraph) => (
                <Paper
                  key={paragraph.id}
                  p="md"
                  withBorder
                  style={{
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Group align="flex-start" gap="md">
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{
                        minWidth: '60px',
                        fontFamily: 'monospace',
                      }}
                    >
                      [段落 {paragraph.order}]
                    </Text>
                    <div style={{ flex: 1 }}>
                      {renderParagraphWithAnnotations(paragraph)}
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Container>
  )
}

export default ReadingPage

