/**
 * 事件相关地点地图
 * 在单个地图上展示事件关联的多个地点的坐标
 */
import { useState, useEffect } from 'react'
import { Box, Loader, Text, Stack } from '@mantine/core'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { useQueries } from '@tanstack/react-query'
import { searchLocation, type LocationSearchResult } from '../../lib/api'
import type { Event } from '../../lib/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const mapContainerStyle = { width: '100%', height: '300px' }
const defaultCenter = { lat: 35.0, lng: 105.0 }
const defaultZoom = 5

function parseLocations(locationName: string | undefined): string[] {
  if (!locationName) return []
  const clean = (s: string) => s.replace(/[（(][^）)]+[）)]/g, '').trim()
  return locationName.split(/[,，]/).map(clean).filter(Boolean)
}

interface EventLocationsMapProps {
  event: Event
  opened: boolean
}

export function EventLocationsMap({ event, opened }: EventLocationsMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<LocationSearchResult | null>(null)

  const locationNames = parseLocations(event.locationName)
  const year = event.timeRangeStart

  const { isLoaded: isGoogleMapsLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  })

  const queries = useQueries({
    queries: locationNames.map((name) => ({
      queryKey: ['location', name, year],
      queryFn: () => searchLocation(name, year),
      enabled: opened && !!name && !!GOOGLE_MAPS_API_KEY,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const locationsWithCoords = queries
    .map((q) => q.data)
    .filter((d): d is LocationSearchResult => !!d)

  useEffect(() => {
    if (!map || locationsWithCoords.length === 0) return
    try {
      if (locationsWithCoords.length === 1) {
        const loc = locationsWithCoords[0]
        map.setCenter({ lat: loc.coordinates.lat, lng: loc.coordinates.lng })
        map.setZoom(10)
      } else {
        const bounds = new google.maps.LatLngBounds()
        locationsWithCoords.forEach((loc) => {
          bounds.extend({
            lat: loc.coordinates.lat,
            lng: loc.coordinates.lng,
          })
        })
        map.fitBounds(bounds)
      }
    } catch {
      // ignore bounds errors
    }
  }, [map, locationsWithCoords])

  if (!GOOGLE_MAPS_API_KEY || locationNames.length === 0) return null

  if (loadError) {
    return (
      <Text size="sm" c="dimmed">
        地图加载失败
      </Text>
    )
  }

  const isLoading = queries.some((q) => q.isLoading)
  const hasAnyCoords = locationsWithCoords.length > 0

  if (isLoading && !hasAnyCoords) {
    return (
      <Box style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="xs" c="dimmed">正在查询地点坐标...</Text>
        </Stack>
      </Box>
    )
  }

  if (!hasAnyCoords) {
    return (
      <Text size="sm" c="dimmed">
        未找到可显示的地点坐标
      </Text>
    )
  }

  if (!isGoogleMapsLoaded) {
    return (
      <Box style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size="sm" />
      </Box>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={defaultZoom}
      onLoad={setMap}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
      }}
    >
      {locationsWithCoords.map((loc) => (
        <Marker
          key={loc.id}
          position={{ lat: loc.coordinates.lat, lng: loc.coordinates.lng }}
          label={{
            text: loc.name.length > 4 ? loc.name.slice(0, 4) + '…' : loc.name,
            color: 'black',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          onClick={() => setSelectedMarker(loc)}
        />
      ))}
      {selectedMarker && (
        <InfoWindow
          position={{
            lat: selectedMarker.coordinates.lat,
            lng: selectedMarker.coordinates.lng,
          }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <Stack gap={4} style={{ minWidth: '200px' }}>
            <Text fw={600} size="sm">{selectedMarker.name}</Text>
            {selectedMarker.transcription && (
              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                {selectedMarker.transcription}
              </Text>
            )}
            {selectedMarker.modernName && (
              <Text size="xs" c="dimmed">现代地名：{selectedMarker.modernName}</Text>
            )}
            {selectedMarker.parentName && (
              <Text size="xs" c="dimmed">所属：{selectedMarker.parentName}</Text>
            )}
            {selectedMarker.timeRange && (
              <Text size="xs" c="dimmed">
                存在时间：{selectedMarker.timeRange.begin} — {selectedMarker.timeRange.end}
              </Text>
            )}
            {selectedMarker.featureType && (
              <Text size="xs" c="dimmed">类型：{selectedMarker.featureType}</Text>
            )}
          </Stack>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
