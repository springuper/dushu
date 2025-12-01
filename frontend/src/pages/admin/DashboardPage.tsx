import { Container, Title, Text, Card, Group } from '@mantine/core'

function DashboardPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">
        管理后台首页
      </Title>

      <Group grow>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4}>数据准备</Title>
          <Text size="sm" c="dimmed" mt="xs">
            管理 LLM 提取的数据和批量导入
          </Text>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4}>内容管理</Title>
          <Text size="sm" c="dimmed" mt="xs">
            管理人物、关系、地点、事件等数据
          </Text>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={4}>系统管理</Title>
          <Text size="sm" c="dimmed" mt="xs">
            数据备份、操作日志等
          </Text>
        </Card>
      </Group>
    </Container>
  )
}

export default DashboardPage

