/**
 * 事件时间轴组件
 * 显示章节相关的历史事件，按时间排序
 */
import {
  Stack,
  Text,
  Card,
  Badge,
  Group,
  ScrollArea,
  Loader,
  Alert,
  Box,
  Timeline,
  Tooltip,
} from '@mantine/core'
import { IconSword, IconCrown, IconUser, IconDots } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getEventsByChapter, type Event } from '../../lib/api'

interface EventTimelineProps {
  chapterId: string
  onEventClick?: (event: Event) => void
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

export function EventTimeline({
  chapterId,
  onEventClick,
  onJumpToParagraph,
  selectedEventId,
}: EventTimelineProps) {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events', 'by-chapter', chapterId],
    queryFn: () => getEventsByChapter(chapterId),
    enabled: !!chapterId,
  })

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">加载事件列表...</Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="加载失败">
        无法加载事件列表
      </Alert>
    )
  }

  if (!events || events.length === 0) {
    return (
      <Box py="xl">
        <Text size="sm" c="dimmed" ta="center">
          暂无事件数据
        </Text>
      </Box>
    )
  }

  return (
    <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        共 {events.length} 个事件
      </Text>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        <Timeline active={-1} bulletSize={24} lineWidth={2}>
          {events.map((event, index) => (
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
                </Group>
              }
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
                      <Text size="xs" c="dimmed">
                        📍 {event.locationName}
                      </Text>
                    )}
                  </Group>

                  <Text size="xs" lineClamp={3}>
                    {event.summary}
                  </Text>

                  {event.actors && event.actors.length > 0 && (
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">参与者:</Text>
                      {event.actors.slice(0, 4).map((actor, i) => (
                        <Tooltip key={i} label={actor.description || actor.roleType}>
                          <Badge size="xs" variant="dot" color="gray">
                            {actor.name}
                          </Badge>
                        </Tooltip>
                      ))}
                      {event.actors.length > 4 && (
                        <Text size="xs" c="dimmed">
                          等 {event.actors.length} 人
                        </Text>
                      )}
                    </Group>
                  )}

                  {event.relatedParagraphs && event.relatedParagraphs.length > 0 && (
                    <Text
                      size="xs"
                      c="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onJumpToParagraph?.(event.relatedParagraphs[0])
                      }}
                    >
                      → 查看原文
                    </Text>
                  )}
                </Stack>
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      </ScrollArea>
    </Stack>
  )
}

