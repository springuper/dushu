/**
 * 信息面板组件
 * 包含人物、事件、关系三个标签页
 */
import { Tabs, Box } from '@mantine/core'
import { IconUsers, IconTimeline, IconLink } from '@tabler/icons-react'
import { PersonList } from './PersonList'
import { EventTimeline } from './EventTimeline'
import { RelationshipGraph } from './RelationshipGraph'
import type { Person, Event } from '../../lib/api'

interface InfoPanelProps {
  chapterId: string
  onPersonClick?: (person: Person) => void
  onEventClick?: (event: Event) => void
  onJumpToParagraph?: (paragraphId: string) => void
  selectedPersonId?: string
  selectedEventId?: string
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function InfoPanel({
  chapterId,
  onPersonClick,
  onEventClick,
  onJumpToParagraph,
  selectedPersonId,
  selectedEventId,
  activeTab = 'events',
  onTabChange,
}: InfoPanelProps) {
  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Tabs 
        value={activeTab} 
        onChange={(value) => onTabChange?.(value || 'events')}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs.List style={{ flexShrink: 0 }}>
          <Tabs.Tab value="events" leftSection={<IconTimeline size={16} />}>
            事件
          </Tabs.Tab>
          <Tabs.Tab value="persons" leftSection={<IconUsers size={16} />}>
            人物
          </Tabs.Tab>
          {/* 暂时隐藏关系标签页 */}
          {/* <Tabs.Tab value="relationships" leftSection={<IconLink size={16} />}>
            关系
          </Tabs.Tab> */}
        </Tabs.List>

        <Tabs.Panel value="events" pt="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <EventTimeline
            chapterId={chapterId}
            onEventClick={onEventClick}
            onJumpToParagraph={onJumpToParagraph}
            selectedEventId={selectedEventId}
          />
        </Tabs.Panel>

        <Tabs.Panel value="persons" pt="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <PersonList
            chapterId={chapterId}
            onPersonClick={onPersonClick}
            selectedPersonId={selectedPersonId}
          />
        </Tabs.Panel>

        {/* 暂时隐藏关系面板 */}
        {/* <Tabs.Panel value="relationships" pt="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <RelationshipGraph chapterId={chapterId} />
        </Tabs.Panel> */}
      </Tabs>
    </Box>
  )
}

