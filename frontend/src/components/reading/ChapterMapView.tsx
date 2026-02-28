/**
 * 章节地图模式
 * 展示本章所有有地点的事件，按顺序标号，支持前后导航与列表联动
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { useQueries } from '@tanstack/react-query'
import { searchLocation, type LocationSearchResult } from '../../lib/api'
import type { Event } from '../../lib/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const defaultCenter = { lat: 35.0, lng: 105.0 }
const defaultZoom = 5

// 与 EventTimeline importance Badge 一致
const importanceMarkerColors: Record<string, string> = {
  L1: '#e03131',   // red
  L2: '#fd7e14',   // orange
  L3: '#868e96',   // gray
}

function parseLocations(locationName: string | undefined): string[] {
  if (!locationName) return []
  const clean = (s: string) => s.replace(/[（(][^）)]+[）)]/g, '').trim()
  return locationName.split(/[,，]/).map(clean).filter(Boolean)
}

function getMarkerColor(importance?: string): string {
  return importanceMarkerColors[importance || ''] || importanceMarkerColors.L3
}

interface MarkerData {
  event: Event
  loc: LocationSearchResult
  mapIndex: number // 1-based display index
}

interface ChapterMapViewProps {
  events: Event[]
  selectedEventId: string | null
  onEventSelect: (event: Event) => void
  onEventDetailClick?: (event: Event) => void
}

export function ChapterMapView({
  events,
  selectedEventId,
  onEventSelect,
  onEventDetailClick,
}: ChapterMapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [infoWindowEvent, setInfoWindowEvent] = useState<Event | null>(null)
  const hasFittedBoundsRef = useRef(false)

  // 切换章节时重置，以便新章节首次加载时 fitBounds
  const chapterKey = events[0]?.chapterId ?? (events.length > 0 ? 'loaded' : 'empty')
  useEffect(() => {
    hasFittedBoundsRef.current = false
  }, [chapterKey])

  const { isLoaded: isGoogleMapsLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  })

  // 1. 过滤有地点的事件，解析地点
  const eventsWithLocation = useMemo(
    () => events.filter((e) => e.locationName?.trim()),
    [events]
  )

  // 2. 批量地理编码：为每个 (event, locationName) 创建 query
  const geocodeKeys = useMemo(() => {
    const keys: { eventId: string; event: Event; locationName: string }[] = []
    for (const event of eventsWithLocation) {
      const names = parseLocations(event.locationName)
      for (const name of names) {
        keys.push({ eventId: event.id, event, locationName: name })
      }
    }
    return keys
  }, [eventsWithLocation])

  const queries = useQueries({
    queries: geocodeKeys.map((k) => ({
      queryKey: ['location', k.locationName, k.event.timeRangeStart] as const,
      queryFn: () => searchLocation(k.locationName, k.event.timeRangeStart),
      enabled: !!GOOGLE_MAPS_API_KEY && !!k.locationName,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // 3. 按 event 聚合：eventId -> LocationSearchResult[]（仅包含有 coordinates 的结果）
  const eventToLocations = useMemo(() => {
    const map = new Map<string, LocationSearchResult[]>()
    geocodeKeys.forEach((k, i) => {
      const data = queries[i]?.data
      if (data?.coordinates?.lat != null && data?.coordinates?.lng != null) {
        const arr = map.get(k.eventId) || []
        arr.push(data)
        map.set(k.eventId, arr)
      }
    })
    return map
  }, [geocodeKeys, queries])

  // 4. 只保留至少有一个地点能地理编码成功的事件，保持原顺序
  const eventsWithValidCoords = useMemo(() => {
    return eventsWithLocation.filter((e) => (eventToLocations.get(e.id)?.length ?? 0) > 0)
  }, [eventsWithLocation, eventToLocations])

  // 5. 展平为 MarkerData[] 用于渲染 marker
  const markerDataList = useMemo(() => {
    const result: MarkerData[] = []
    eventsWithValidCoords.forEach((event, idx) => {
      const locs = eventToLocations.get(event.id) || []
      const mapIndex = idx + 1
      for (const loc of locs) {
        result.push({ event, loc, mapIndex })
      }
    })
    return result
  }, [eventsWithValidCoords, eventToLocations])

  // 6. 仅在首次有 marker 时 fitBounds，避免用户手动缩放后被打断
  useEffect(() => {
    if (!map || markerDataList.length === 0 || hasFittedBoundsRef.current) return
    try {
      const bounds = new google.maps.LatLngBounds()
      const seen = new Set<string>()
      for (const m of markerDataList) {
        const key = `${m.loc.coordinates.lat},${m.loc.coordinates.lng}`
        if (seen.has(key)) continue
        seen.add(key)
        bounds.extend({
          lat: m.loc.coordinates.lat,
          lng: m.loc.coordinates.lng,
        })
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 })
        hasFittedBoundsRef.current = true
      }
    } catch {
      // ignore
    }
  }, [map, markerDataList])

  // 7. 选中事件变化时 panTo
  useEffect(() => {
    if (!map || !selectedEventId || markerDataList.length === 0) return
    const first = markerDataList.find((m) => m.event.id === selectedEventId)
    if (!first) return
    map.panTo({
      lat: first.loc.coordinates.lat,
      lng: first.loc.coordinates.lng,
    })
  }, [map, selectedEventId, markerDataList])

  const currentIndex = eventsWithValidCoords.findIndex((e) => e.id === selectedEventId)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex >= 0 && currentIndex < eventsWithValidCoords.length - 1

  const handlePrev = () => {
    if (!canGoPrev) return
    setInfoWindowEvent(null)
    const event = eventsWithValidCoords[currentIndex - 1]
    onEventSelect(event)
  }

  const handleNext = () => {
    if (!canGoNext) return
    setInfoWindowEvent(null)
    const event = eventsWithValidCoords[currentIndex + 1]
    onEventSelect(event)
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="sm" c="dimmed">
          请配置 VITE_GOOGLE_MAPS_API_KEY 以使用地图模式
        </Text>
      </Box>
    )
  }

  if (loadError) {
    return (
      <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="sm" c="dimmed">
          地图加载失败
        </Text>
      </Box>
    )
  }

  const isLoading = queries.some((q) => q.isLoading)
  const hasAnyCoords = markerDataList.length > 0

  if (isLoading && !hasAnyCoords) {
    return (
      <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="xs" c="dimmed">
            正在查询地点坐标...
          </Text>
        </Stack>
      </Box>
    )
  }

  if (!hasAnyCoords) {
    return (
      <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="sm" c="dimmed">
          {eventsWithLocation.length === 0
            ? '本章事件均无地点信息'
            : '未能解析到可显示的地点坐标'}
        </Text>
      </Box>
    )
  }

  if (!isGoogleMapsLoaded) {
    return (
      <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size="sm" />
      </Box>
    )
  }

  return (
    <Box pos="relative" w="100%" h="100%">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={defaultCenter}
        zoom={defaultZoom}
        onLoad={setMap}
        onClick={() => setInfoWindowEvent(null)}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {markerDataList.map((m, i) => {
          if (m.loc?.coordinates?.lat == null || m.loc?.coordinates?.lng == null) return null
          const isSelected = m.event.id === selectedEventId
          const color = getMarkerColor(m.event.importance)
          const size = isSelected ? 32 : 24
          const strokeColor = isSelected ? '#1971c2' : '#fff'
          const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
  <text x="${size/2}" y="${size/2 + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold">${m.mapIndex}</text>
</svg>`
          const icon = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(size, size),
            anchor: new google.maps.Point(size / 2, size / 2),
          }
          return (
            <Marker
              key={`${m.event.id}-${m.loc.id}-${i}`}
              position={{ lat: m.loc.coordinates.lat, lng: m.loc.coordinates.lng }}
              icon={icon}
              onClick={() => {
                onEventSelect(m.event)
                setInfoWindowEvent(m.event)
              }}
            />
          )
        })}
        {infoWindowEvent && (() => {
          const locs = eventToLocations.get(infoWindowEvent.id)
          const first = locs?.[0]
          if (!first || first.coordinates?.lat == null || first.coordinates?.lng == null) return null
          return (
            <InfoWindow
              position={{
                lat: first.coordinates.lat,
                lng: first.coordinates.lng,
              }}
              onCloseClick={() => setInfoWindowEvent(null)}
            >
              <Stack gap={4} style={{ minWidth: '200px' }}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={600} size="sm" style={{ flex: 1, minWidth: 0 }}>
                    {infoWindowEvent.name}
                  </Text>
                  <Box
                    component="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setInfoWindowEvent(null)
                    }}
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      padding: 0,
                      border: '1px solid #ced4da',
                      borderRadius: 4,
                      background: '#fff',
                      color: '#495057',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="关闭"
                  >
                    ×
                  </Box>
                </Group>
                <Text size="xs" c="dimmed">
                  {infoWindowEvent.timeRangeStart}
                  {infoWindowEvent.timeRangeEnd && ` — ${infoWindowEvent.timeRangeEnd}`}
                </Text>
                {infoWindowEvent.summary && (
                  <Text size="xs" lineClamp={3}>
                    {infoWindowEvent.summary}
                  </Text>
                )}
                {onEventDetailClick && (
                  <Text
                    size="xs"
                    c="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onEventDetailClick(infoWindowEvent)}
                  >
                    查看详情
                  </Text>
                )}
              </Stack>
            </InfoWindow>
          )
        })()}
      </GoogleMap>

      {/* 右上角 上一个/下一个 */}
      <Box
        pos="absolute"
        top={12}
        right={12}
        style={{
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 8,
          padding: '4px 8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        <Group gap={4}>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconChevronLeft size={14} />}
            disabled={!canGoPrev}
            onClick={handlePrev}
          >
            上一个
          </Button>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconChevronRight size={14} />}
            disabled={!canGoNext}
            onClick={handleNext}
          >
            下一个
          </Button>
        </Group>
      </Box>
    </Box>
  )
}
