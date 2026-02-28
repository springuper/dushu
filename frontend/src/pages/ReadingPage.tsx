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
  ScrollArea,
  Switch,
  SegmentedControl,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import * as OpenCC from 'opencc-js'
import { getChapterById, getPersons, getEventsByChapter, type Person, type Event, type EventImportanceFilter } from '../lib/api'
import React, { useState, useMemo, useRef, useCallback } from 'react'
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCalendarEvent } from '@tabler/icons-react'
import { InfoPanel, EventDetailModal, PersonDetailDrawer, ChapterMapView } from '../components/reading'

interface TextMention {
  entityType: 'PERSON' | 'PLACE'
  entityId: string
  startIndex: number
  endIndex: number
}

interface Paragraph {
  id: string
  order: number
  text: string
  translation?: string | null
  annotations: Annotation[]
  mentions?: TextMention[]
}

interface Annotation {
  id: string
  targetText: string
  explanation: string
  position: number
}

interface PlaceInfo {
  id: string
  name: string
  aliases: string[]
  modernLocation?: string | null
  geographicContext?: string | null
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
  persons?: Person[]
  places?: PlaceInfo[]
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

// 繁简转换，避免繁体原文无法匹配简体人物名
type ConverterFn = (input: string) => string
let s2tConverter: ConverterFn | null = null
let t2sConverter: ConverterFn | null = null
try {
  const Converter = (OpenCC as any)?.Converter
  if (Converter) {
    s2tConverter = Converter({ from: 'cn', to: 't' })
    t2sConverter = Converter({ from: 't', to: 'cn' })
  }
} catch (err) {
  console.warn('OpenCC init failed, name highlight may miss traditional variants', err)
}

const nameWithVariants = (name: string): string[] => {
  const variants = new Set<string>()
  if (name) variants.add(name)
  if (s2tConverter) variants.add(s2tConverter(name))
  if (t2sConverter) variants.add(t2sConverter(name))
  return Array.from(variants).filter(Boolean)
}

function ReadingPage() {
  const { chapterId } = useParams<{ chapterId: string }>()
  const navigate = useNavigate()
  const [showInfoPanel, setShowInfoPanel] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)
  const [showHighlight, setShowHighlight] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [activeTab, setActiveTab] = useState('events')
  const [eventImportanceFilter, setEventImportanceFilter] = useState<EventImportanceFilter>('L1,L2')
  const [eventDetailModalEvent, setEventDetailModalEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'reading' | 'map'>('reading')
  const paragraphRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const { data: chapter, isLoading, error } = useQuery<Chapter>({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapterById(chapterId!),
    enabled: !!chapterId,
    retry: 1,
  })

  // 获取当前章节的人物（用于高亮回退，主数据来自 chapter.persons）
  const { data: personsData } = useQuery({
    queryKey: ['persons', { chapterId, pageSize: 200 }],
    queryFn: () => getPersons({ chapterId, pageSize: 200 }),
    enabled: !!chapterId,
  })

  // 获取章节事件列表（支持等级筛选）
  const { data: events } = useQuery({
    queryKey: ['events', 'by-chapter', chapterId, eventImportanceFilter],
    queryFn: () => getEventsByChapter(chapterId!, { importance: eventImportanceFilter }),
    enabled: !!chapterId,
  })

  // 构建段落ID到事件的映射
  const paragraphEventsMap = useMemo(() => {
    const map = new Map<string, Event[]>()
    if (!events) return map
    
    for (const event of events) {
      if (event.relatedParagraphs) {
        for (const paragraphId of event.relatedParagraphs) {
          const existing = map.get(paragraphId) || []
          existing.push(event)
          map.set(paragraphId, existing)
        }
      }
    }
    return map
  }, [events])

  // 使用当前章节的人物和地点（用于 mention 高亮）
  const chapterPersons = chapter?.persons || []
  const chapterPlaces = chapter?.places || []
  const persons = chapterPersons.length > 0 ? chapterPersons : (personsData?.items || [])

  // 实体 ID 映射（用于 mention 的 HoverCard）
  const entityMap = useMemo(() => {
    const map = new Map<string, Person | PlaceInfo>()
    for (const p of chapterPersons) {
      map.set(p.id, p)
    }
    for (const p of chapterPlaces) {
      map.set(p.id, p)
    }
    return map
  }, [chapterPersons, chapterPlaces])

  // 构建人物名称到人物的映射
  const personNameMap = useMemo(() => {
    const map = new Map<string, Person>()
    for (const person of persons) {
      const variants = new Set<string>()
      nameWithVariants(person.name).forEach(v => variants.add(v))
      person.aliases.forEach(alias => nameWithVariants(alias).forEach(v => variants.add(v)))

      variants.forEach(v => {
        if (!map.has(v)) {
          map.set(v, person)
        }
      })
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

  // 处理事件点击：选中事件 + 跳转到第一个相关段落（仅阅读模式）
  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event)
    setActiveTab('events')
    // 阅读模式下，跳转到第一个相关段落；地图模式下由 ChapterMapView 负责 panTo
    if (viewMode === 'reading' && event.relatedParagraphs && event.relatedParagraphs.length > 0) {
      handleJumpToParagraph(event.relatedParagraphs[0])
    }
    // 确保信息面板可见
    if (!showInfoPanel) {
      setShowInfoPanel(true)
    }
  }, [handleJumpToParagraph, showInfoPanel, viewMode])

  // 段落内事件标签点击：直接打开详情弹窗
  const handleParagraphEventClick = useCallback((event: Event) => {
    setEventDetailModalEvent(event)
  }, [])

  // 从事件列表打开详情弹窗
  const handleEventDetailClick = useCallback((event: Event) => {
    setEventDetailModalEvent(event)
  }, [])

  // 处理人物点击：选中人物 + 切换到人物tab
  const handlePersonClick = useCallback((person: Person) => {
    setSelectedPerson(person)
    setActiveTab('persons')
    // 确保信息面板可见
    if (!showInfoPanel) {
      setShowInfoPanel(true)
    }
  }, [showInfoPanel])

  // 判断段落是否与选中事件相关
  const isParagraphRelatedToSelectedEvent = useCallback((paragraphId: string) => {
    if (!selectedEvent) return false
    return selectedEvent.relatedParagraphs?.includes(paragraphId) || false
  }, [selectedEvent])

  // 渲染带有人物高亮的文本
  const renderTextWithHighlight = (text: string) => {
    if (!personRegex) {
      return text
    }

    const parts: (string | React.ReactElement)[] = []
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
                onClick={() => handlePersonClick(person)}
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

  // 渲染 mention span（人物/地点 HoverCard）
  const renderMentionSpan = (mention: TextMention, paragraph: Paragraph, key: string) => {
    const entity = entityMap.get(mention.entityId)
    const spanText = paragraph.text.substring(mention.startIndex, mention.endIndex)
    if (!entity) return <Text key={key} component="span">{spanText}</Text>

    if (mention.entityType === 'PERSON') {
      const person = entity as Person
      return (
        <HoverCard key={key} width={320} shadow="md" withArrow>
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
              onClick={() => handlePersonClick(person)}
            >
              {spanText}
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
              {person.aliases?.length > 0 && (
                <Text size="xs" c="dimmed">又称：{person.aliases.join('、')}</Text>
              )}
              <Group gap="xs">
                <Badge size="xs" variant="outline" color="gray">
                  {roleNames[person.role] || person.role}
                </Badge>
                {person.birthYear && person.deathYear && (
                  <Text size="xs" c="dimmed">{person.birthYear}—{person.deathYear}</Text>
                )}
              </Group>
              <Text size="sm" lineClamp={4}>{person.biography}</Text>
            </Stack>
          </HoverCard.Dropdown>
        </HoverCard>
      )
    }

    const place = entity as PlaceInfo
    return (
      <HoverCard key={key} width={300} shadow="md" withArrow>
        <HoverCard.Target>
          <Text
            component="span"
            style={{
              cursor: 'pointer',
              backgroundColor: '#40c05715',
              borderBottom: '2px solid #40c057',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {spanText}
          </Text>
        </HoverCard.Target>
        <HoverCard.Dropdown>
          <Stack gap="xs">
            <Text fw={600}>{place.name}</Text>
            {place.aliases?.length > 0 && (
              <Text size="xs" c="dimmed">又称：{place.aliases.join('、')}</Text>
            )}
            {place.modernLocation && (
              <Text size="sm">现代位置：{place.modernLocation}</Text>
            )}
            {place.geographicContext && (
              <Text size="sm" lineClamp={3}>{place.geographicContext}</Text>
            )}
          </Stack>
        </HoverCard.Dropdown>
      </HoverCard>
    )
  }

  // 将段落文本与注释、mentions 合并显示
  const renderParagraphContent = (paragraph: Paragraph) => {
    const annotations = paragraph.annotations || []
    const mentions = (showHighlight && paragraph.mentions && paragraph.mentions.length > 0)
      ? paragraph.mentions
      : []

    // 构建按位置排序的 span 列表
    type Span = { start: number; end: number; type: 'text' | 'annotation' | 'mention'; data: any }
    const spans: Span[] = []

    annotations.forEach((ann) => {
      spans.push({
        start: ann.position,
        end: ann.position + ann.targetText.length,
        type: 'annotation',
        data: ann,
      })
    })
    mentions.forEach((m) => {
      spans.push({ start: m.startIndex, end: m.endIndex, type: 'mention', data: m })
    })
    spans.sort((a, b) => a.start - b.start)

    // 若无任何标注，直接用原文（根据 showHighlight 决定是否 regex 高亮）
    if (spans.length === 0) {
      const content = showHighlight ? renderTextWithHighlight(paragraph.text) : paragraph.text
      return <Text style={{ lineHeight: 1.8 }}>{content}</Text>
    }

    const result: (string | React.ReactElement)[] = []
    let lastIndex = 0

    for (const span of spans) {
      if (span.start < lastIndex) continue
      if (span.start > lastIndex) {
        const plain = paragraph.text.substring(lastIndex, span.start)
        const content = showHighlight ? renderTextWithHighlight(plain) : plain
        result.push(...(Array.isArray(content) ? content : [content]))
      }
      if (span.type === 'annotation') {
        const ann = span.data
        const text = paragraph.text.substring(ann.position, ann.position + ann.targetText.length)
        result.push(
          <Popover key={`ann-${ann.id}`} width={300} position="top" withArrow shadow="md">
            <Popover.Target>
              <Text component="span" style={{ cursor: 'help', borderBottom: '1px dotted #666', color: '#0066cc' }}>
                {text}
              </Text>
            </Popover.Target>
            <Popover.Dropdown><Text size="sm">{ann.explanation}</Text></Popover.Dropdown>
          </Popover>
        )
      } else {
        result.push(renderMentionSpan(span.data, paragraph, `m-${span.start}-${span.end}`))
      }
      lastIndex = span.end
    }
    if (lastIndex < paragraph.text.length) {
      const plain = paragraph.text.substring(lastIndex)
      const content = showHighlight ? renderTextWithHighlight(plain) : plain
      result.push(...(Array.isArray(content) ? content : [content]))
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
    <>
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
          <Group gap="md">
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => {
                setViewMode(v as 'reading' | 'map')
                if (v === 'map') setActiveTab('events')
              }}
              data={[
                { value: 'reading', label: '阅读模式' },
                { value: 'map', label: '地图模式' },
              ]}
            />
            <Group gap="xs">
              <Tooltip label="显示/隐藏现代文翻译">
                <Switch
                  size="xs"
                  label="现代文"
                  checked={showTranslation}
                  onChange={(e) => setShowTranslation(e.currentTarget.checked)}
                />
              </Tooltip>
              <Tooltip label="人物/地点高亮">
                <Switch
                  size="xs"
                  label="高亮"
                  checked={showHighlight}
                  onChange={(e) => setShowHighlight(e.currentTarget.checked)}
                />
              </Tooltip>
            </Group>
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
            padding={viewMode === 'map' ? 0 : 'xl'}
            radius="md"
            withBorder
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'white',
            }}
          >
            {viewMode === 'map' ? (
              <Box style={{ flex: 1, minHeight: 0 }}>
                <ChapterMapView
                  events={events || []}
                  selectedEventId={selectedEvent?.id ?? null}
                  onEventSelect={(event) => handleEventClick(event)}
                  onEventDetailClick={(event) => setEventDetailModalEvent(event)}
                />
              </Box>
            ) : (
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
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
                    {chapter.paragraphs.map((paragraph) => {
                      const relatedEvents = paragraphEventsMap.get(paragraph.id) || []
                      const isRelatedToSelected = isParagraphRelatedToSelectedEvent(paragraph.id)
                      
                      return (
                        <Paper
                          key={paragraph.id}
                          p="md"
                          withBorder
                          ref={(el) => {
                            if (el) paragraphRefs.current.set(paragraph.id, el)
                          }}
                          style={{
                            backgroundColor: isRelatedToSelected ? '#e7f5ff' : '#fafafa',
                            borderColor: isRelatedToSelected ? '#339af0' : undefined,
                            borderWidth: isRelatedToSelected ? 2 : 1,
                            transition: 'all 0.3s',
                          }}
                        >
                          <Group align="flex-start" gap="md">
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ fontFamily: 'monospace', minWidth: '70px', flexShrink: 0 }}
                            >
                              [段落 {paragraph.order}]
                            </Text>
                            <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                              {renderParagraphContent(paragraph)}
                              {showTranslation && paragraph.translation && (
                                <Box pt="sm" style={{ borderTop: '1px dashed #dee2e6' }}>
                                  <Text size="sm" c="dimmed" mb={4}>
                                    现代文
                                  </Text>
                                  <Text size="sm" style={{ lineHeight: 1.7 }}>
                                    {paragraph.translation}
                                  </Text>
                                </Box>
                              )}
                              {/* 正文下方显示相关事件标签 */}
                              {relatedEvents.length > 0 && (
                                <Group gap={4} mt="xs">
                                  {relatedEvents.map((e) => (
                                    <Badge
                                      key={e.id}
                                      size="xs"
                                      variant="light"
                                      color="blue"
                                      leftSection={<IconCalendarEvent size={10} />}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleParagraphEventClick(e)}
                                    >
                                      {e.name}
                                    </Badge>
                                  ))}
                                </Group>
                              )}
                            </Stack>
                          </Group>
                        </Paper>
                      )
                    })}
                  </Stack>
                )}
              </Stack>
            </ScrollArea>
            )}
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
                  events={events}
                  eventImportanceFilter={eventImportanceFilter}
                  onEventImportanceFilterChange={setEventImportanceFilter}
                  onPersonClick={handlePersonClick}
                  onEventClick={handleEventClick}
                  onEventDetailClick={handleEventDetailClick}
                  onJumpToParagraph={handleJumpToParagraph}
                  selectedPersonId={selectedPerson?.id}
                  selectedEventId={selectedEvent?.id}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </Card>
            </Box>
          )}
      </Box>
    </Box>

    <EventDetailModal
      event={eventDetailModalEvent}
      opened={!!eventDetailModalEvent}
      onClose={() => setEventDetailModalEvent(null)}
      onViewInTimeline={(event) => {
        setShowInfoPanel(true)
        setActiveTab('events')
        handleEventClick(event)
      }}
      onJumpToParagraph={handleJumpToParagraph}
    />

    <PersonDetailDrawer
      person={selectedPerson}
      chapterId={chapterId ?? ''}
      opened={!!selectedPerson && !!chapterId}
      onClose={() => setSelectedPerson(null)}
      onEventClick={(event) => {
        handleEventClick(event)
        setSelectedPerson(null) // 关闭抽屉，让用户看到事件面板
      }}
    />
    </>
  )
}

export default ReadingPage
