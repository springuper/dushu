import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface ProtectedRouteProps {
  children: React.ReactNode
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const response = await api.get('/api/admin/me', {
        withCredentials: true,
      })
      return response.data
    },
    retry: false,
  })

  if (isLoading) {
    return <div>加载中...</div>
  }

  if (error || !data) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

