/**
 * 事件详情弹窗
 * 展示事件的完整信息
 */
import { Modal, Stack, Text, Group, Badge, Divider, Box } from '@mantine/core'
import { IconSword, IconCrown, IconUser, IconDots, IconMapPin, IconCalendar, IconTimeline, IconBook2 } from '@tabler/icons-react'
import type { Event, EventActor } from '../../lib/api'
import { importanceLabels } from '../../lib/api'
import { EventLocationsMap } from './EventLocationsMap'

const roleTypeNames: Record<string, string> = {
  PROTAGONIST: '主角',
  ALLY: '同盟',
  OPPOSING: '对立',
  ADVISOR: '谋士',
  EXECUTOR: '执行',
  OBSERVER: '旁观',
  OTHER: '其他',
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  BATTLE: <IconSword size={16} />,
  POLITICAL: <IconCrown size={16} />,
  PERSONAL: <IconUser size={16} />,
  OTHER: <IconDots size={16} />,
}

const eventTypeColors: Record<string, string> = {
  BATTLE: 'red',
  POLITICAL: 'orange',
  PERSONAL: 'blue',
  OTHER: 'gray',
}

const eventTypeNames: Record<string, string> = {
  BATTLE: '战役',
  POLITICAL: '政治',
  PERSONAL: '人物',
  OTHER: '其他',
}

interface EventDetailModalProps {
  event: Event | null
  opened: boolean
  onClose: () => void
  onViewInTimeline?: (event: Event) => void
  onJumpToParagraph?: (paragraphId: string) => void
}

export function EventDetailModal({
  event,
  opened,
  onClose,
  onViewInTimeline,
  onJumpToParagraph,
}: EventDetailModalProps) {
  if (!event) return null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          {eventTypeIcons[event.type] || <IconDots size={16} />}
          <Text fw={600}>{event.name}</Text>
          <Badge size="sm" color={eventTypeColors[event.type] || 'gray'} variant="light">
            {eventTypeNames[event.type] || event.type}
          </Badge>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        {/* 来源章节 */}
        {event.chapter && (
          <Text size="xs" c="dimmed">
            {event.chapter.book?.name} · {event.chapter.title}
          </Text>
        )}

        {/* 年份、地点、事件等级 */}
        <Group gap="md" wrap="wrap">
          <Group gap={4}>
            <IconCalendar size={14} />
            <Text size="sm">
              {event.timeRangeStart}
              {event.timeRangeEnd && ` — ${event.timeRangeEnd}`}
            </Text>
          </Group>
          {(event.locationName || event.locationModernName) && (
            <Group gap={4}>
              <IconMapPin size={14} />
              <Box>
                <Text size="sm" component="span">{event.locationName}</Text>
                {event.locationModernName && (
                  <Text size="xs" c="dimmed" component="span" ml={4}>
                    （{event.locationModernName}）
                  </Text>
                )}
              </Box>
            </Group>
          )}
          {event.importance && (
            <Badge
              size="sm"
              variant="light"
              color={event.importance === 'L1' ? 'red' : event.importance === 'L2' ? 'orange' : 'gray'}
            >
              {event.importance} · {importanceLabels[event.importance] || event.importance}
            </Badge>
          )}
        </Group>

        {/* 相关地点地图 */}
        {(event.locationName || event.locationModernName) && (
          <>
            <Divider label="地点分布" labelPosition="left" />
            <EventLocationsMap event={event} opened={opened} />
          </>
        )}

        {/* 事件摘要 */}
        <Box>
          <Text size="sm" fw={500} mb={4}>事件摘要</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {event.summary}
          </Text>
        </Box>

        {event.impact && (
          <>
            <Divider label="历史影响" labelPosition="left" />
            <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
              {event.impact}
            </Text>
          </>
        )}

        {event.actors && event.actors.length > 0 && (
          <>
            <Divider label="参与者" labelPosition="left" />
            <Stack gap="xs">
              {event.actors.map((actor: EventActor, i) => (
                <Group key={i} gap="xs">
                  <Badge size="sm" variant="light" color="gray">
                    {actor.name}
                  </Badge>
                  {actor.roleType && actor.roleType !== 'OTHER' && (
                    <Text size="xs" c="dimmed">
                      {roleTypeNames[actor.roleType] || actor.roleType}
                    </Text>
                  )}
                  {actor.description && (
                    <Text size="xs" c="dimmed">
                      {actor.description}
                    </Text>
                  )}
                </Group>
              ))}
            </Stack>
          </>
        )}

        <Divider />

        <Group gap="md">
          {onViewInTimeline && (
            <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => {
              onViewInTimeline(event)
              onClose()
            }}>
              <IconTimeline size={16} />
              <Text size="sm" c="blue" style={{ textDecoration: 'underline' }}>
                在时间轴中查看
              </Text>
            </Group>
          )}
          {onJumpToParagraph && event.relatedParagraphs && event.relatedParagraphs.length > 0 && (
            <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => {
              onJumpToParagraph(event.relatedParagraphs[0])
              onClose()
            }}>
              <IconBook2 size={16} />
              <Text size="sm" c="blue" style={{ textDecoration: 'underline' }}>
                查看原文{event.relatedParagraphs.length > 1 ? `（共 ${event.relatedParagraphs.length} 段）` : ''}
              </Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
