import { useParams } from 'react-router-dom'
import { Container, Title, Text } from '@mantine/core'

function ReadingPage() {
  const { chapterId } = useParams<{ chapterId: string }>()

  return (
    <Container size="lg" py="xl">
      <Title order={1}>阅读页面</Title>
      <Text size="lg" mt="md">
        章节 ID: {chapterId}
      </Text>
    </Container>
  )
}

export default ReadingPage

