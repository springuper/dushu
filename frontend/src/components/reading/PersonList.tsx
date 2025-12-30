/**
 * 人物列表组件
 * 显示章节相关的人物，支持阵营筛选和搜索
 */
import { useState, useMemo } from 'react'
import {
  Stack,
  TextInput,
  SegmentedControl,
  Card,
  Text,
  Badge,
  Group,
  ScrollArea,
  Loader,
  Alert,
  Box,
  Button,
} from '@mantine/core'
import { IconSearch, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getPersons, type Person } from '../../lib/api'

interface PersonListProps {
  chapterId?: string
  onPersonClick?: (person: Person) => void
  selectedPersonId?: string
}

// 阵营颜色映射
const factionColors: Record<string, string> = {
  HAN: 'red',
  CHU: 'blue',
  QIN: 'gray',
  NEUTRAL: 'gray',
  OTHER: 'gray',
}

// 阵营中文名
const factionNames: Record<string, string> = {
  HAN: '汉',
  CHU: '楚',
  QIN: '秦',
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

export function PersonList({ onPersonClick, selectedPersonId }: PersonListProps) {
  const [search, setSearch] = useState('')
  const [factionFilter, setFactionFilter] = useState<string>('all')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['persons', { pageSize: 100 }],
    queryFn: () => getPersons({ pageSize: 100 }),
  })

  // 过滤人物
  const filteredPersons = useMemo(() => {
    if (!data?.items) return []
    
    return data.items.filter(person => {
      // 阵营筛选
      if (factionFilter !== 'all' && person.faction !== factionFilter) {
        return false
      }
      
      // 搜索筛选
      if (search) {
        const searchLower = search.toLowerCase()
        return (
          person.name.toLowerCase().includes(searchLower) ||
          person.aliases.some(a => a.toLowerCase().includes(searchLower)) ||
          person.biography.toLowerCase().includes(searchLower)
        )
      }
      
      return true
    })
  }, [data?.items, factionFilter, search])

  // 切换卡片展开状态
  const toggleExpand = (personId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发卡片的 onClick
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(personId)) {
        next.delete(personId)
      } else {
        next.add(personId)
      }
      return next
    })
  }

  // 判断内容是否需要展开（超过约100字符或包含换行）
  const needsExpand = (biography: string) => {
    return biography && (biography.length > 100 || biography.includes('\n'))
  }

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">加载人物列表...</Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert color="red" title="加载失败">
        无法加载人物列表
      </Alert>
    )
  }

  return (
    <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
      {/* 搜索框 */}
      <TextInput
        placeholder="搜索人物..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="sm"
        style={{ flexShrink: 0 }}
      />

      {/* 阵营筛选 */}
      <SegmentedControl
        size="xs"
        value={factionFilter}
        onChange={setFactionFilter}
        data={[
          { label: '全部', value: 'all' },
          { label: '汉', value: 'HAN' },
          { label: '楚', value: 'CHU' },
          { label: '其他', value: 'OTHER' },
        ]}
        fullWidth
        style={{ flexShrink: 0 }}
      />

      {/* 人物数量提示 */}
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        共 {filteredPersons.length} 位人物
      </Text>

      {/* 人物列表 */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
        <Stack gap="sm">
          {filteredPersons.map(person => (
            <Card
              key={person.id}
              padding="sm"
              radius="sm"
              withBorder
              style={{
                cursor: 'pointer',
                backgroundColor: selectedPersonId === person.id ? 'var(--mantine-color-blue-0)' : undefined,
                borderColor: selectedPersonId === person.id ? 'var(--mantine-color-blue-4)' : undefined,
              }}
              onClick={() => onPersonClick?.(person)}
            >
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={600} size="sm" style={{ whiteSpace: 'nowrap' }}>
                      {person.name}
                    </Text>
                    {person.aliases.length > 0 && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        ({person.aliases.slice(0, 2).join('/')})
                      </Text>
                    )}
                  </Group>
                  <Badge
                    size="xs"
                    color={factionColors[person.faction] || 'gray'}
                    variant="light"
                  >
                    {factionNames[person.faction] || person.faction}
                  </Badge>
                </Group>

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

                {person.biography && (
                  <>
                    <Text 
                      size="xs" 
                      c="dimmed" 
                      lineClamp={expandedCards.has(person.id) ? undefined : 2}
                    >
                      {person.biography}
                    </Text>
                    {needsExpand(person.biography) && (
                      <Button
                        variant="subtle"
                        size="xs"
                        compact
                        leftSection={expandedCards.has(person.id) ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                        onClick={(e) => toggleExpand(person.id, e)}
                        style={{ alignSelf: 'flex-start', padding: '2px 8px' }}
                      >
                        {expandedCards.has(person.id) ? '收起' : '展开全部'}
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Card>
          ))}

          {filteredPersons.length === 0 && (
            <Box py="xl">
              <Text size="sm" c="dimmed" ta="center">
                没有找到匹配的人物
              </Text>
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

