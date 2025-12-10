/**
 * 关系图谱组件
 * 显示人物之间的关系，基于共同事件推断
 */
import { useState } from 'react'
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
  Select,
  Progress,
  Modal,
  Timeline,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getPersons, getPersonRelationships, getRelationship, type Person, type RelationshipResponse } from '../../lib/api'

interface RelationshipGraphProps {
  chapterId?: string
}

// 阵营颜色
const factionColors: Record<string, string> = {
  HAN: 'red',
  CHU: 'blue',
  NEUTRAL: 'gray',
  OTHER: 'gray',
}

// 阵营中文名
const factionNames: Record<string, string> = {
  HAN: '汉',
  CHU: '楚',
  NEUTRAL: '中立',
  OTHER: '其他',
}

// 角色类型中文名
const roleTypeNames: Record<string, string> = {
  PROTAGONIST: '主角',
  ALLY: '盟友',
  OPPOSING: '对立',
  ADVISOR: '谋士',
  EXECUTOR: '执行',
  OBSERVER: '旁观',
  OTHER: '其他',
}

export function RelationshipGraph({ chapterId }: RelationshipGraphProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [relationshipDetail, setRelationshipDetail] = useState<RelationshipResponse | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // 获取人物列表
  const { data: personsData, isLoading: personsLoading } = useQuery({
    queryKey: ['persons', { pageSize: 100 }],
    queryFn: () => getPersons({ pageSize: 100 }),
  })

  // 获取选中人物的关系
  const { data: relationships, isLoading: relLoading } = useQuery({
    queryKey: ['person-relationships', selectedPerson],
    queryFn: () => getPersonRelationships(selectedPerson!, 15),
    enabled: !!selectedPerson,
  })

  // 获取关系详情
  const handleViewRelationship = async (personBId: string) => {
    if (!selectedPerson) return
    try {
      const detail = await getRelationship(selectedPerson, personBId)
      setRelationshipDetail(detail)
      setDetailModalOpen(true)
    } catch (e) {
      console.error('Failed to get relationship detail', e)
    }
  }

  const persons = personsData?.items || []

  if (personsLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">加载人物数据...</Text>
      </Stack>
    )
  }

  // 找到最大关系数用于计算进度条
  const maxEventCount = relationships?.reduce((max: number, r: any) => 
    Math.max(max, r.sharedEventCount), 0) || 1

  return (
    <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
      {/* 人物选择器 */}
      <Select
        placeholder="选择一个人物查看其关系"
        data={persons.map(p => ({
          value: p.id,
          label: `${p.name} (${factionNames[p.faction] || p.faction})`,
        }))}
        value={selectedPerson}
        onChange={setSelectedPerson}
        searchable
        clearable
        size="sm"
        style={{ flexShrink: 0 }}
      />

      {selectedPerson && (
        <>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            与 {persons.find(p => p.id === selectedPerson)?.name} 共同参与事件的人物：
          </Text>

          {relLoading ? (
            <Stack align="center" py="md">
              <Loader size="sm" />
            </Stack>
          ) : relationships && relationships.length > 0 ? (
            <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
              <Stack gap="sm">
                {relationships.map((rel: any) => (
                  <Card
                    key={rel.person.id}
                    padding="sm"
                    radius="sm"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleViewRelationship(rel.person.id)}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {rel.person.name}
                          </Text>
                          <Badge
                            size="xs"
                            color={factionColors[rel.person.faction] || 'gray'}
                            variant="light"
                          >
                            {factionNames[rel.person.faction] || rel.person.faction}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {rel.sharedEventCount} 次共同事件
                        </Text>
                      </Group>

                      <Progress
                        value={(rel.sharedEventCount / maxEventCount) * 100}
                        size="xs"
                        color={factionColors[rel.person.faction] || 'gray'}
                      />

                      <Text size="xs" c="blue">
                        点击查看关系详情 →
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          ) : (
            <Box py="xl">
              <Text size="sm" c="dimmed" ta="center">
                没有找到共同事件
              </Text>
            </Box>
          )}
        </>
      )}

      {!selectedPerson && (
        <Box py="xl">
          <Text size="sm" c="dimmed" ta="center">
            请选择一个人物查看其与其他人物的关系
          </Text>
        </Box>
      )}

      {/* 关系详情模态框 */}
      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          relationshipDetail && (
            <Group gap="xs">
              <Text fw={600}>{relationshipDetail.personA.name}</Text>
              <Text c="dimmed">与</Text>
              <Text fw={600}>{relationshipDetail.personB.name}</Text>
              <Text c="dimmed">的关系时间线</Text>
            </Group>
          )
        }
        size="lg"
      >
        {relationshipDetail && (
          <Stack>
            <Text size="sm" c="dimmed">
              共有 {relationshipDetail.sharedEventsCount} 次共同事件
            </Text>

            <ScrollArea h={400}>
              <Timeline active={-1} bulletSize={20} lineWidth={2}>
                {relationshipDetail.timeline.map((item, index) => (
                  <Timeline.Item
                    key={item.eventId}
                    title={item.eventName}
                    bullet={<Text size="xs">{index + 1}</Text>}
                  >
                    <Card padding="xs" radius="sm" withBorder mt="xs">
                      <Stack gap="xs">
                        <Text size="xs" c="dimmed">{item.time}</Text>
                        <Text size="sm">{item.summary}</Text>
                        
                        <Group gap="xl">
                          <Stack gap={2}>
                            <Text size="xs" fw={500}>{relationshipDetail.personA.name}</Text>
                            <Badge size="xs" variant="light">
                              {roleTypeNames[item.personARole || ''] || item.personARole}
                            </Badge>
                            {item.personADescription && (
                              <Text size="xs" c="dimmed">{item.personADescription}</Text>
                            )}
                          </Stack>
                          
                          <Stack gap={2}>
                            <Text size="xs" fw={500}>{relationshipDetail.personB.name}</Text>
                            <Badge size="xs" variant="light">
                              {roleTypeNames[item.personBRole || ''] || item.personBRole}
                            </Badge>
                            {item.personBDescription && (
                              <Text size="xs" c="dimmed">{item.personBDescription}</Text>
                            )}
                          </Stack>
                        </Group>
                      </Stack>
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
            </ScrollArea>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}

