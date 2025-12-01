import { Component, ReactNode } from 'react'
import { Container, Title, Text, Button } from '@mantine/core'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container size="lg" py="xl">
          <Title order={1} c="red">
            出错了
          </Title>
          <Text mt="md" c="red">
            {this.state.error?.message || '未知错误'}
          </Text>
          <Button
            mt="md"
            onClick={() => {
              this.setState({ hasError: false, error: undefined })
              window.location.reload()
            }}
          >
            重新加载
          </Button>
        </Container>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

