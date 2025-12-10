import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await api.post('/api/admin/login', data, {
        withCredentials: true,
      })
      return response.data
    },
    onSuccess: () => {
      navigate('/admin')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || '登录失败')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ username, password })
  }

  return (
    <Container size={420} my={40}>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={2} ta="center" mb="md">
          管理后台登录
        </Title>

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextInput
            label="用户名"
            placeholder="请输入用户名"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            mb="md"
          />

          <PasswordInput
            label="密码"
            placeholder="请输入密码"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            mb="md"
          />

          <Button
            type="submit"
            fullWidth
            loading={loginMutation.isPending}
            mt="xl"
          >
            登录
          </Button>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt="md">
          默认账号: admin / admin123
        </Text>
      </Paper>
    </Container>
  )
}

export default LoginPage

