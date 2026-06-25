import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import HistoryPage from './pages/HistoryPage';
import ProcessPage from './pages/ProcessPage';
import TimeSheetPage from './pages/TimeSheetPage';


export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/project/:id/process" element={<ProcessPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/timesheet" element={<TimeSheetPage />} />

        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

