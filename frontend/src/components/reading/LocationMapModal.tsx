/**
 * 地点地图模态窗口组件
 * 显示历史地名的 Google Maps 地图
 */
import { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Stack,
  Text,
  Loader,
  Alert,
  Button,
  Group,
  Box,
} from '@mantine/core'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { useQuery } from '@tanstack/react-query'
import { searchLocation, type LocationSearchResult, type Event } from '../../lib/api'

interface LocationMapModalProps {
  opened: boolean
  onClose: () => void
  locationName: string
  year?: string
  relatedEvent?: Event
  onViewEvent?: (event: Event) => void
}

// Google Maps 配置
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// 地图容器样式
const mapContainerStyle = {
  width: '100%',
  height: '500px',
}

// 默认地图中心（中国中部）
const defaultCenter = {
  lat: 35.0,
  lng: 105.0,
}

// 默认缩放级别
const defaultZoom = 6

export function LocationMapModal({
  opened,
  onClose,
  locationName,
  year,
  relatedEvent,
  onViewEvent,
}: LocationMapModalProps) {
  const [selectedMarker, setSelectedMarker] = useState<LocationSearchResult | null>(null)
  
  // 全局加载 Google Maps API（避免重复加载）
  const { isLoaded: isGoogleMapsLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  })

  // 查询地点坐标
  const {
    data: locationData,
    isLoading,
    error,
    refetch,
  } = useQuery<LocationSearchResult>({
    queryKey: ['location', locationName, year],
    queryFn: () => searchLocation(locationName, year),
    enabled: opened && !!locationName && !!GOOGLE_MAPS_API_KEY,
    retry: 1,
  })

  // 当查询成功时，设置选中的标记
  useEffect(() => {
    if (locationData) {
      setSelectedMarker(locationData)
    }
  }, [locationData])

  // 处理查看事件
  const handleViewEvent = () => {
    if (relatedEvent && onViewEvent) {
      onViewEvent(relatedEvent)
      onClose()
    }
  }

  // 如果没有配置 API Key，显示提示
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="地点位置"
        size="xl"
      >
        <Alert color="yellow" title="配置缺失">
          <Text size="sm">
            Google Maps API Key 未配置。请在环境变量中设置 VITE_GOOGLE_MAPS_API_KEY。
          </Text>
        </Alert>
      </Modal>
    )
  }

  // Google Maps 加载错误
  if (loadError) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="地点位置"
        size="xl"
      >
        <Alert color="red" title="地图加载失败">
          <Text size="sm">
            无法加载 Google Maps，请检查网络连接或 API Key 配置。
          </Text>
        </Alert>
      </Modal>
    )
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>📍 {locationName}</Text>
          {year && (
            <Text size="sm" c="dimmed">
              ({year})
            </Text>
          )}
        </Group>
      }
      size="xl"
    >
      <Stack gap="md">
        {/* 加载状态 */}
        {isLoading && (
          <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '500px' }}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text size="sm" c="dimmed">正在查询地点信息...</Text>
            </Stack>
          </Box>
        )}

        {/* 错误状态 */}
        {error && (
          <Alert color="orange" title="未找到历史坐标">
            <Stack gap="sm">
              <Text size="sm">
                {error instanceof Error ? error.message : '未找到该地点的坐标信息'}
              </Text>
              <Text size="xs" c="dimmed">
                该历史地名可能尚未录入知识库，或需要更精确的名称。
              </Text>
              {relatedEvent?.locationModernName && (
                <Button 
                  size="xs" 
                  variant="light" 
                  onClick={() => {
                    // 使用现代地名在 Google Maps 中搜索
                    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(relatedEvent.locationModernName)}`
                    window.open(searchUrl, '_blank')
                  }}
                >
                  使用现代地名搜索：{relatedEvent.locationModernName}
                </Button>
              )}
              <Button size="xs" variant="light" onClick={() => refetch()}>
                重试查询
              </Button>
            </Stack>
          </Alert>
        )}

        {/* 地图显示 */}
        {locationData && !isLoading && isGoogleMapsLoaded && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={{
              lat: locationData.coordinates.lat,
              lng: locationData.coordinates.lng,
            }}
            zoom={defaultZoom}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
              <Marker
                position={{
                  lat: locationData.coordinates.lat,
                  lng: locationData.coordinates.lng,
                }}
                onClick={() => setSelectedMarker(locationData)}
              />

              {selectedMarker && (
                <InfoWindow
                  position={{
                    lat: selectedMarker.coordinates.lat,
                    lng: selectedMarker.coordinates.lng,
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <Stack gap="xs" style={{ minWidth: '200px' }}>
                    <Text fw={600}>{selectedMarker.name}</Text>
                    {selectedMarker.transcription && (
                      <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                        {selectedMarker.transcription}
                      </Text>
                    )}
                    {selectedMarker.parentName && (
                      <Text size="sm" c="dimmed">
                        所属：{selectedMarker.parentName}
                      </Text>
                    )}
                    {selectedMarker.modernName && (
                      <Text size="sm" c="dimmed">
                        {selectedMarker.modernName}
                      </Text>
                    )}
                    {selectedMarker.timeRange && (
                      <Text size="xs" c="dimmed">
                        存在时间：{selectedMarker.timeRange.begin} - {selectedMarker.timeRange.end}
                      </Text>
                    )}
                    {selectedMarker.featureType && (
                      <Text size="xs" c="dimmed">
                        类型：{selectedMarker.featureType}
                      </Text>
                    )}
                  </Stack>
                </InfoWindow>
              )}
            </GoogleMap>
        )}
        
        {/* Google Maps 加载中 */}
        {!isGoogleMapsLoaded && !loadError && locationData && !isLoading && (
          <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '500px' }}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text size="sm" c="dimmed">正在加载地图...</Text>
            </Stack>
          </Box>
        )}

        {/* 相关信息 */}
        {locationData && (
          <Stack gap="xs">
            {locationData.transcription && (
              <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                <Text component="span" fw={600}>音译：</Text>
                {locationData.transcription}
              </Text>
            )}
            {locationData.parentName && (
              <Text size="sm">
                <Text component="span" fw={600}>所属：</Text>
                {locationData.parentName}
              </Text>
            )}
            {locationData.modernName && (
              <Text size="sm">
                <Text component="span" fw={600}>现代地名：</Text>
                {locationData.modernName}
              </Text>
            )}
            {locationData.timeRange && (
              <Text size="sm" c="dimmed">
                历史存在时间：{locationData.timeRange.begin} - {locationData.timeRange.end}
              </Text>
            )}
            {locationData.featureType && (
              <Text size="sm" c="dimmed">
                类型：{locationData.featureType}
              </Text>
            )}
          </Stack>
        )}

        {/* 相关事件链接 */}
        {relatedEvent && (
          <Button
            variant="light"
            fullWidth
            onClick={handleViewEvent}
          >
            查看相关事件：{relatedEvent.name}
          </Button>
        )}
      </Stack>
    </Modal>
  )
}

