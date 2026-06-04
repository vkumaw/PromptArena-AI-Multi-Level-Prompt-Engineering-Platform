import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Level1Page } from './pages/Level1Page';
import { Level2Page } from './pages/Level2Page';
import { Level3Page } from './pages/Level3Page';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RegisterPage } from './pages/RegisterPage';


export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/level-1"
            element={
              <ProtectedRoute>
                <Level1Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/level-2"
            element={
              <ProtectedRoute>
                <Level2Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/level-3"
            element={
              <ProtectedRoute>
                <Level3Page />
              </ProtectedRoute>
            }
          />
          <Route
  path="/analytics"
  element={
    <ProtectedRoute>
      <AnalyticsPage />
    </ProtectedRoute>
  }
/>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}