import { Container, Title, Text, Card, Badge, Button } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { healthCheck } from '../lib/api'

function HomePage() {
  const { data: healthData, isLoading, error, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
    retry: 1, // 重试一次
    retryDelay: 1000,
  })

  return (
    <Container size="lg" py="xl">
      <Title order={1}>历史阅读增强 App</Title>
      <Text size="lg" mt="md" mb="xl">
        欢迎使用历史阅读增强 App
      </Text>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          系统状态
        </Title>

        <div style={{ marginBottom: '1rem' }}>
          <Text fw={500} mb="xs">
            后端 API 连接：
          </Text>
          {isLoading && <Badge color="blue">检查中...</Badge>}
          {error && (
            <div>
              <Badge color="red" mb="xs">连接失败</Badge>
              <Text size="xs" c="red" mt="xs">
                {error instanceof Error 
                  ? error.message 
                  : (error as any)?.response?.data?.error || '无法连接到后端服务器'}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                请确保后端服务器运行在 http://localhost:3001
              </Text>
            </div>
          )}
          {healthData && (
            <Badge color="green">
              ✅ 连接正常 - {healthData.status}
            </Badge>
          )}
        </div>

        {healthData && (
          <div style={{ marginBottom: '1rem' }}>
            <Text size="sm" c="dimmed">
              服务器时间: {new Date(healthData.timestamp).toLocaleString('zh-CN')}
            </Text>
          </div>
        )}

        <Button onClick={() => refetch()} variant="light" size="sm">
          重新检查
        </Button>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
        <Title order={3} mb="md">
          快速导航
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          功能开发中，敬请期待...
        </Text>
        <Button
          component="a"
          href="/admin/login"
          variant="outline"
          size="sm"
        >
          管理后台
        </Button>
      </Card>
    </Container>
  )
}

export default HomePage

