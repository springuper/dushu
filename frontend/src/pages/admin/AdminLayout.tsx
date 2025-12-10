import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppShell,
  Text,
  Group,
  Button,
  NavLink,
  Burger,
  Title,
} from '@mantine/core'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'

function AdminLayout() {
  const [opened, setOpened] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // 获取当前管理员信息
  const { data: admin } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const response = await api.get('/api/admin/me', {
        withCredentials: true,
      })
      return response.data
    },
    retry: false,
  })

  // 登出
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/admin/logout', {}, { withCredentials: true })
    },
    onSuccess: () => {
      navigate('/admin/login')
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  const navItems = [
    {
      label: '数据准备',
      children: [
        { label: '审核管理', path: '/admin/review' },
        { label: '批量导入', path: '/admin/import' },
      ],
    },
    {
      label: '内容管理',
      children: [
        { label: '书籍管理', path: '/admin/books' },
        { label: '书籍章节', path: '/admin/chapters' },
        { label: '章节处理', path: '/admin/chapter-process' },
        { label: '事件管理', path: '/admin/events' },
        { label: '人物管理', path: '/admin/persons' },
      ],
    },
    {
      label: '系统管理',
      children: [
        { label: '操作日志', path: '/admin/logs' },
      ],
    },
  ]

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 200,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={() => setOpened((o) => !o)}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={4}>管理后台</Title>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {admin?.username}
            </Text>
            <Button variant="subtle" size="xs" onClick={handleLogout}>
              退出
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navItems.map((section) => (
          <div key={section.label}>
            <Text size="xs" fw={700} c="dimmed" mb="xs" px="md">
              {section.label}
            </Text>
            {section.children.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                active={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path)
                  setOpened(false)
                }}
              />
            ))}
          </div>
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

export default AdminLayout

