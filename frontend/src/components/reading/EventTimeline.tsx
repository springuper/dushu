/**
 * 事件时间轴组件
 * 显示章节相关的历史事件，按时间排序，支持等级筛选
 */
import { useState, useRef, useEffect } from 'react'
import {
  Stack,
  Text,
  Card,
  Badge,
  Group,
  ScrollArea,
  Loader,
  Box,
  Timeline,
  Tooltip,
  Button,
  SegmentedControl,
} from '@mantine/core'
import { IconSword, IconCrown, IconUser, IconDots, IconChevronDown, IconChevronUp, IconInfoCircle, IconBook2 } from '@tabler/icons-react'
import { type Event, type EventImportanceFilter, importanceLabels } from '../../lib/api'
import { LocationMapModal } from './LocationMapModal'

interface EventTimelineProps {
  events?: Event[]
  eventImportanceFilter: EventImportanceFilter
  onEventImportanceFilterChange?: (filter: EventImportanceFilter) => void
  onEventClick?: (event: Event) => void
  onEventDetailClick?: (event: Event) => void
  onJumpToParagraph?: (paragraphId: string) => void
  selectedEventId?: string
}

// 事件类型颜色
const eventTypeColors: Record<string, string> = {
  BATTLE: 'red',
  POLITICAL: 'orange',
  PERSONAL: 'blue',
  OTHER: 'gray',
}

// 事件类型图标
const eventTypeIcons: Record<string, React.ReactNode> = {
  BATTLE: <IconSword size={14} />,
  POLITICAL: <IconCrown size={14} />,
  PERSONAL: <IconUser size={14} />,
  OTHER: <IconDots size={14} />,
}

// 事件类型中文名
const eventTypeNames: Record<string, string> = {
  BATTLE: '战役',
  POLITICAL: '政治',
  PERSONAL: '人物',
  OTHER: '其他',
}

// 精简=L1, 中等=L1+L2, 详细=L1+L2+L3
const IMPORTANCE_OPTIONS: { value: EventImportanceFilter; label: string }[] = [
  { value: 'L1', label: '精简' },
  { value: 'L1,L2', label: '中等' },
  { value: 'L1,L2,L3', label: '详细' },
]

export function EventTimeline({
  events = [],
  eventImportanceFilter,
  onEventImportanceFilterChange,
  onEventClick,
  onEventDetailClick,
  onJumpToParagraph,
  selectedEventId,
}: EventTimelineProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [mapModalOpened, setMapModalOpened] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; year?: string; event?: Event } | null>(null)
  const eventItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const eventList = events ?? []

  // 选中事件时滚动到该事件
  useEffect(() => {
    if (!selectedEventId || eventList.length === 0) return
    const el = eventItemRefs.current.get(selectedEventId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedEventId, eventList.length])

  // 切换卡片展开状态
  const toggleExpand = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发卡片的 onClick
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  // 判断内容是否需要展开
  // 由于 lineClamp={3} 大约能显示 100-150 个字符（取决于字体和宽度）
  // 我们设置一个较低的阈值，确保大部分需要展开的内容都能显示按钮
  const needsExpand = (summary: string) => {
    if (!summary) return false
    // 降低阈值：超过80字符或包含换行就显示展开按钮
    return summary.length > 80 || summary.includes('\n')
  }

  // 清理地点名称：处理括号格式，提取主地名
  // 格式：'主地名 (别名/区域)' -> 返回'主地名'
  const cleanLocationName = (location: string): string => {
    // 移除括号及其内容，提取主地名
    const cleaned = location.replace(/[（(][^）)]+[）)]/g, '').trim()
    return cleaned || location.trim()
  }

  // 解析多个地点（逗号分隔）
  const parseLocations = (locationName: string | undefined): string[] => {
    if (!locationName) return []
    return locationName.split(/[,，]/).map(loc => cleanLocationName(loc)).filter(Boolean)
  }

  // 处理地点点击
  const handleLocationClick = (locationName: string, event: Event, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发卡片的 onClick
    setSelectedLocation({
      name: locationName,
      year: event.timeRangeStart,
      event,
    })
    setMapModalOpened(true)
  }

  // events 为 undefined 表示父组件正在加载
  const isLoading = events === undefined
  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">加载事件列表...</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
      <Group justify="space-between" wrap="nowrap" style={{ flexShrink: 0 }}>
        <Text size="xs" c="dimmed">
          共 {eventList.length} 个事件
        </Text>
        {onEventImportanceFilterChange && (
          <SegmentedControl
            size="xs"
            value={eventImportanceFilter}
            onChange={(v) => onEventImportanceFilterChange(v as EventImportanceFilter)}
            data={IMPORTANCE_OPTIONS}
          />
        )}
      </Group>

      {eventList.length === 0 ? (
        <Box py="xl">
          <Text size="sm" c="dimmed" ta="center">
            暂无事件数据
          </Text>
        </Box>
      ) : (
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        <Timeline active={-1} bulletSize={24} lineWidth={2}>
          {eventList.map((event) => (
            <Timeline.Item
              key={event.id}
              bullet={eventTypeIcons[event.type] || <IconDots size={14} />}
              color={eventTypeColors[event.type] || 'gray'}
              title={
                <Group gap="xs" wrap="nowrap">
                  <Text
                    size="sm"
                    fw={600}
                    style={{
                      cursor: 'pointer',
                      color: selectedEventId === event.id ? 'var(--mantine-color-blue-6)' : undefined,
                    }}
                    onClick={() => onEventClick?.(event)}
                  >
                    {event.name}
                  </Text>
                  <Badge
                    size="xs"
                    color={eventTypeColors[event.type] || 'gray'}
                    variant="light"
                  >
                    {eventTypeNames[event.type] || event.type}
                  </Badge>
                  {event.importance && (
                    <Badge
                      size="xs"
                      variant="outline"
                      color={event.importance === 'L1' ? 'red' : event.importance === 'L2' ? 'orange' : 'gray'}
                    >
                      {importanceLabels[event.importance] || event.importance}
                    </Badge>
                  )}
                </Group>
              }
            >
              <Box
                ref={(el) => {
                  if (el) eventItemRefs.current.set(event.id, el)
                }}
                data-event-id={event.id}
              >
              <Card
                padding="xs"
                radius="sm"
                withBorder
                mt="xs"
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedEventId === event.id ? 'var(--mantine-color-blue-0)' : undefined,
                  borderColor: selectedEventId === event.id ? 'var(--mantine-color-blue-4)' : undefined,
                }}
                onClick={() => onEventClick?.(event)}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {event.timeRangeStart}
                      {event.timeRangeEnd && ` — ${event.timeRangeEnd}`}
                    </Text>
                    {event.locationName && (
                      <Group gap={4} wrap="wrap">
                        {parseLocations(event.locationName).map((location, idx) => (
                          <Text
                            key={idx}
                            size="xs"
                            c="blue"
                            style={{
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                            onClick={(e) => handleLocationClick(location, event, e)}
                          >
                            📍 {location}
                          </Text>
                        ))}
                      </Group>
                    )}
                  </Group>

                  {event.summary && (
                    <>
                      <Text 
                        size="xs" 
                        lineClamp={expandedCards.has(event.id) ? undefined : 3}
                      >
                        {event.summary}
                      </Text>
                      {needsExpand(event.summary) && (
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={expandedCards.has(event.id) ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                          onClick={(e) => toggleExpand(event.id, e)}
                          style={{ alignSelf: 'flex-start', padding: '2px 8px' }}
                        >
                          {expandedCards.has(event.id) ? '收起' : '展开全部'}
                        </Button>
                      )}
                    </>
                  )}

                  {event.actors && event.actors.length > 0 && (
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">参与者:</Text>
                      {event.actors.map((actor, i) => (
                        <Tooltip key={i} label={actor.description || actor.roleType}>
                          <Badge size="xs" variant="dot" color="gray">
                            {actor.name}
                          </Badge>
                        </Tooltip>
                      ))}
                    </Group>
                  )}

                  {(event.relatedParagraphs?.length > 0 || onEventDetailClick) && (
                    <Group gap="xs">
                    {event.relatedParagraphs && event.relatedParagraphs.length > 0 && (
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={(e) => {
                        e.stopPropagation()
                        onJumpToParagraph?.(event.relatedParagraphs[0])
                      }}>
                        <IconBook2 size={12} />
                        <Text size="xs" c="blue">查看原文</Text>
                      </Group>
                    )}
                    {onEventDetailClick && (
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={(e) => {
                        e.stopPropagation()
                        onEventDetailClick(event)
                      }}>
                        <IconInfoCircle size={12} />
                        <Text size="xs" c="blue">查看详情</Text>
                      </Group>
                    )}
                    </Group>
                  )}
                </Stack>
              </Card>
              </Box>
            </Timeline.Item>
          ))}
        </Timeline>
      </ScrollArea>
      )}

      {/* 地点地图模态窗口 */}
      {selectedLocation && (
        <LocationMapModal
          opened={mapModalOpened}
          onClose={() => {
            setMapModalOpened(false)
            setSelectedLocation(null)
          }}
          locationName={selectedLocation.name}
          year={selectedLocation.year}
          relatedEvent={selectedLocation.event}
          onViewEvent={(event) => {
            onEventClick?.(event)
            setMapModalOpened(false)
            setSelectedLocation(null)
          }}
        />
      )}
    </Stack>
  )
}

