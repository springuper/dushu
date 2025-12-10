import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Button,
  Stack,
  Loader,
  Alert,
  Breadcrumbs,
  Anchor,
  Paper,
  Popover,
  Box,
  ActionIcon,
  Tooltip,
  HoverCard,
  Badge,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getChapterById, getPersons, type Person, type Event } from '../lib/api'
import { useState, useMemo, useRef, useCallback } from 'react'
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand } from '@tabler/icons-react'
import { InfoPanel } from '../components/reading'

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

// 阵营颜色
const factionColors: Record<string, string> = {
  HAN: '#e03131',
  CHU: '#1971c2',
  NEUTRAL: '#868e96',
  OTHER: '#868e96',
}

// 阵营中文名
const factionNames: Record<string, string> = {
  HAN: '汉',
  CHU: '楚',
  NEUTRAL: '中立',
  OTHER: '其他',
}

// 角色中文名
const roleNames: Record<string, string> = {
  MONARCH: '君主',
  ADVISOR: '谋士',
  GENERAL: '将领',
  CIVIL_OFFICIAL: '文臣',
  MILITARY_OFFICIAL: '武将',
  RELATIVE: '外戚',
  EUNUCH: '宦官',
  OTHER: '其他',
}

function ReadingPage() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const [showInfoPanel, setShowInfoPanel] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const paragraphRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: chapter, isLoading, error } = useQuery<Chapter>({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapterById(chapterId!),
    enabled: !!chapterId,
    retry: 1,
  })

  // 获取人物列表用于高亮
  const { data: personsData } = useQuery({
    queryKey: ['persons', { pageSize: 100 }],
    queryFn: () => getPersons({ pageSize: 100 }),
  })

  const persons = personsData?.items || []

  // 构建人物名称到人物的映射
  const personNameMap = useMemo(() => {
    const map = new Map<string, Person>()
    for (const person of persons) {
      map.set(person.name, person)
      for (const alias of person.aliases) {
        if (!map.has(alias)) {
          map.set(alias, person)
        }
      }
    }
    return map
  }, [persons])

  // 构建用于匹配的正则表达式（按名称长度降序排列，优先匹配更长的名称）
  const personRegex = useMemo(() => {
    if (personNameMap.size === 0) return null
    const names = Array.from(personNameMap.keys())
      .sort((a, b) => b.length - a.length)
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return new RegExp(`(${names.join('|')})`, 'g')
  }, [personNameMap])

  // 跳转到指定段落
  const handleJumpToParagraph = useCallback((paragraphId: string) => {
    const element = paragraphRefs.current.get(paragraphId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 高亮闪烁效果
      element.style.backgroundColor = '#fff3cd'
      setTimeout(() => {
        element.style.backgroundColor = ''
      }, 2000)
    }
  }, [])

  // 渲染带有人物高亮的文本
  const renderTextWithHighlight = (text: string) => {
    if (!personRegex) {
      return text
    }

    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let match

    const regex = new RegExp(personRegex.source, 'g')
    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }

      const matchedName = match[1]
      const person = personNameMap.get(matchedName)

      if (person) {
        parts.push(
          <HoverCard key={`${match.index}-${matchedName}`} width={320} shadow="md" withArrow>
            <HoverCard.Target>
              <Text
                component="span"
                style={{
                  cursor: 'pointer',
                  backgroundColor: `${factionColors[person.faction]}15`,
                  borderBottom: `2px solid ${factionColors[person.faction]}`,
                  padding: '0 2px',
                  borderRadius: '2px',
                }}
                onClick={() => setSelectedPerson(person)}
              >
                {matchedName}
              </Text>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>{person.name}</Text>
                  <Badge color={factionColors[person.faction] === '#e03131' ? 'red' : 'blue'} variant="light">
                    {factionNames[person.faction]}
                  </Badge>
                </Group>
                {person.aliases.length > 0 && (
                  <Text size="xs" c="dimmed">
                    又称：{person.aliases.join('、')}
                  </Text>
                )}
                <Group gap="xs">
                  <Badge size="xs" variant="outline" color="gray">
                    {roleNames[person.role] || person.role}
                  </Badge>
                  {person.birthYear && person.deathYear && (
                    <Text size="xs" c="dimmed">
                      {person.birthYear}—{person.deathYear}
                    </Text>
                  )}
                </Group>
                <Text size="sm" lineClamp={4}>
                  {person.biography}
                </Text>
              </Stack>
            </HoverCard.Dropdown>
          </HoverCard>
        )
      } else {
        parts.push(matchedName)
      }

      lastIndex = match.index + match[0].length
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts
  }

  // 将段落文本与注释合并显示，并添加人物高亮
  const renderParagraphWithAnnotations = (paragraph: Paragraph) => {
    if (!paragraph.annotations || paragraph.annotations.length === 0) {
      return <Text style={{ lineHeight: 1.8 }}>{renderTextWithHighlight(paragraph.text)}</Text>
    }

    // 按位置排序注释
    const sortedAnnotations = [...paragraph.annotations].sort((a, b) => a.position - b.position)

    let result: (string | JSX.Element)[] = []
    let lastIndex = 0

    sortedAnnotations.forEach((annotation) => {
      // 添加注释前的文本
      if (annotation.position > lastIndex) {
        const textBefore = paragraph.text.substring(lastIndex, annotation.position)
        result.push(...(Array.isArray(renderTextWithHighlight(textBefore)) 
          ? renderTextWithHighlight(textBefore) as (string | JSX.Element)[]
          : [renderTextWithHighlight(textBefore) as string]))
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
      const textAfter = paragraph.text.substring(lastIndex)
      result.push(...(Array.isArray(renderTextWithHighlight(textAfter))
        ? renderTextWithHighlight(textAfter) as (string | JSX.Element)[]
        : [renderTextWithHighlight(textAfter) as string]))
    }

    return <Text style={{ lineHeight: 1.8 }}>{result}</Text>
  }

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center" py="xl">
          <Loader size="md" />
          <Text c="dimmed">加载中...</Text>
        </Group>
      </Container>
    )
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" title="加载失败">
          {error instanceof Error ? error.message : '无法加载章节内容，请稍后重试'}
        </Alert>
      </Container>
    )
  }

  if (!chapter) {
    return (
      <Container size="xl" py="xl">
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
    <Box
      style={{
        height: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
      }}
    >
      {/* 顶部导航栏 */}
      <Box
        px="md"
        py="sm"
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e9ecef',
        }}
      >
        <Group justify="space-between">
          <Group gap="md">
            <Button variant="subtle" size="xs" onClick={() => navigate(`/book/${chapter.book.id}`)}>
              ← 返回
            </Button>
            <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
          </Group>
          <Group gap="xs">
            <Tooltip label={showInfoPanel ? '隐藏信息面板' : '显示信息面板'}>
              <ActionIcon
                variant="subtle"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
              >
                {showInfoPanel ? <IconLayoutSidebarRightCollapse size={18} /> : <IconLayoutSidebarRightExpand size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* 主内容区 */}
      <Box style={{ flex: 1, minHeight: 0, padding: '16px', display: 'flex', gap: '16px' }}>
        {/* 阅读区 */}
        <Box style={{ flex: showInfoPanel ? 2 : 1, minWidth: 0, minHeight: 0 }}>
          <Card
            shadow="sm"
            padding="xl"
            radius="md"
            withBorder
            style={{
              height: '100%',
              overflowY: 'auto',
              backgroundColor: 'white',
            }}
          >
              <Stack gap="xl">
                <div>
                  <Title order={2} mb="sm">
                    {chapter.title}
                  </Title>
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
                        ref={(el) => {
                          if (el) paragraphRefs.current.set(paragraph.id, el)
                        }}
                        style={{
                          backgroundColor: '#fafafa',
                          transition: 'background-color 0.3s',
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
          </Box>

          {/* 信息面板 */}
          {showInfoPanel && (
            <Box style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <Card
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{
                  height: '100%',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                }}
              >
                <InfoPanel
                  chapterId={chapterId!}
                  onPersonClick={setSelectedPerson}
                  onEventClick={setSelectedEvent}
                  onJumpToParagraph={handleJumpToParagraph}
                  selectedPersonId={selectedPerson?.id}
                  selectedEventId={selectedEvent?.id}
                />
              </Card>
            </Box>
          )}
      </Box>
    </Box>
  )
}

export default ReadingPage
