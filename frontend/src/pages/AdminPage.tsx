import { Container, Title, Text } from '@mantine/core'

function AdminPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1}>管理后台</Title>
      <Text size="lg" mt="md">
        管理后台页面
      </Text>
    </Container>
  )
}

export default AdminPage

