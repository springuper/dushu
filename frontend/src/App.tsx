import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@mantine/core'
import HomePage from './pages/HomePage'
import ReadingPage from './pages/ReadingPage'
import TestPage from './pages/TestPage'
import AdminLayout from './pages/admin/AdminLayout'
import LoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AppShell>
      <AppShell.Main>
        <Routes>
          <Route path="/test" element={<TestPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/reading/:chapterId" element={<ReadingPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="review" element={<div>Review 工具（开发中）</div>} />
            <Route path="import" element={<div>批量导入（开发中）</div>} />
            <Route path="persons" element={<div>人物管理（开发中）</div>} />
            <Route
              path="relationships"
              element={<div>关系管理（开发中）</div>}
            />
            <Route path="places" element={<div>地点管理（开发中）</div>} />
            <Route path="events" element={<div>事件管理（开发中）</div>} />
            <Route path="backup" element={<div>数据备份（开发中）</div>} />
            <Route path="logs" element={<div>操作日志（开发中）</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
