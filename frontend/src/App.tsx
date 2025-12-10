import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ReadingPage from './pages/ReadingPage'
import BookDetailPage from './pages/BookDetailPage'
import TestPage from './pages/TestPage'
import AdminLayout from './pages/admin/AdminLayout'
import LoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import ReviewPage from './pages/admin/ReviewPage'
import ImportPage from './pages/admin/ImportPage'
import PersonsPage from './pages/admin/PersonsPage'
import ChaptersPage from './pages/admin/ChaptersPage'
import BooksPage from './pages/admin/BooksPage'
import ChapterProcessPage from './pages/admin/ChapterProcessPage'
import EventsPage from './pages/admin/EventsPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/test" element={<TestPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/book/:bookId" element={<BookDetailPage />} />
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
        <Route path="review" element={<ReviewPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="chapters" element={<ChaptersPage />} />
        <Route path="chapter-process" element={<ChapterProcessPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="persons" element={<PersonsPage />} />
        <Route path="logs" element={<div>操作日志（开发中）</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
