import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import HomeDashboard from './pages/HomeDashboard';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import ProcessOutputPage from './pages/ProcessOutputPage';
import TimeSheetPage from './pages/TimeSheetPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import ProjectGroupPage from './pages/ProjectGroupPage';
import CalendarPage from './pages/CalendarPage';


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<Layout><AdminPage /></Layout>} />
          <Route path="/" element={<Layout><HomeDashboard /></Layout>} />
          <Route path="/projects" element={<Layout><DashboardPage /></Layout>} />
          <Route path="/project/:id" element={<Layout><ProcessOutputPage /></Layout>} />
          <Route path="/project/:id/process" element={<Layout><ProcessOutputPage /></Layout>} />
          <Route path="/history" element={<Layout><HistoryPage /></Layout>} />
          <Route path="/timesheet" element={<Layout><TimeSheetPage /></Layout>} />
          <Route path="/group" element={<Layout><ProjectGroupPage /></Layout>} />
          <Route path="/calendar" element={<Layout><CalendarPage /></Layout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
