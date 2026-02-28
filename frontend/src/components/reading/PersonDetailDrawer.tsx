/**
 * 人物详情抽屉
 * 展示人物基本信息及本章关联事件
 */
import { Drawer, Stack, Text, Group, Badge, Divider, Loader, Alert, Box } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getPersonById } from '../../lib/api'
import type { Person, Event } from '../../lib/api'

const factionColors: Record<string, string> = {
  HAN: 'red',
  CHU: 'blue',
  QIN: 'gray',
  NEUTRAL: 'gray',
  OTHER: 'gray',
}

const factionNames: Record<string, string> = {
  HAN: '汉',
  CHU: '楚',
  QIN: '秦',
  NEUTRAL: '中立',
  OTHER: '其他',
}

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

interface PersonDetailDrawerProps {
  person: Person | null
  chapterId: string
  opened: boolean
  onClose: () => void
  onEventClick?: (event: Event) => void
}

export function PersonDetailDrawer({
  person,
  chapterId,
  opened,
  onClose,
  onEventClick,
}: PersonDetailDrawerProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['person', person?.id, chapterId],
    queryFn: () => getPersonById(person!.id, chapterId),
    enabled: !!person?.id && !!chapterId && opened,
  })

  if (!person) return null

  const personData = data as (Person & { chapterEvents?: Event[] }) | undefined
  const chapterEvents = personData?.chapterEvents || []

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>{person.name}</Text>
          <Badge color={factionColors[person.faction] || 'gray'} variant="light" size="sm">
            {factionNames[person.faction] || person.faction}
          </Badge>
        </Group>
      }
      size="md"
      position="right"
    >
      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">加载中...</Text>
        </Stack>
      ) : error ? (
        <Alert color="red" title="加载失败">
          无法加载人物详情
        </Alert>
      ) : (
        <Stack gap="md">
          {person.aliases?.length > 0 && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">又称：</Text>
              <Text size="sm">{person.aliases.join('、')}</Text>
            </Group>
          )}

          <Group gap="xs">
            <Badge size="sm" variant="outline" color="gray">
              {roleNames[person.role] || person.role}
            </Badge>
            {(person.birthYear || person.deathYear) && (
              <Text size="sm" c="dimmed">
                {person.birthYear || '?'} — {person.deathYear || '?'}
              </Text>
            )}
          </Group>

          <Divider label="传记" labelPosition="left" />
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {person.biography}
          </Text>

          <Divider
            label={`本章关联事件 (${chapterEvents.length})`}
            labelPosition="left"
          />
          {chapterEvents.length === 0 ? (
            <Text size="sm" c="dimmed">
              该人物在本章节未参与事件
            </Text>
          ) : (
            <Stack gap="xs">
              {chapterEvents.map((event) => (
                <Box
                  key={event.id}
                  p="xs"
                  style={{
                    border: '1px solid var(--mantine-color-gray-2)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    cursor: onEventClick ? 'pointer' : undefined,
                    backgroundColor: 'var(--mantine-color-gray-0)',
                  }}
                  onClick={() => onEventClick?.(event)}
                >
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" fw={500}>
                      {event.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {event.timeRangeStart}
                    </Text>
                  </Group>
                  {event.summary && (
                    <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                      {event.summary}
                    </Text>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Drawer>
  )
}
