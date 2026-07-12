import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, History, Clock, Cog, Kanban, Users,
  ChevronLeft, Menu, X, User, Edit3, Check, LogOut, Shield,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: ReactNode;
}

const PERSONAL_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'My Projects', icon: Kanban, end: false },
  { to: '/history', label: 'History', icon: History, end: false },
  { to: '/timesheet', label: 'Time Sheet', icon: Clock, end: false },
];

const TEAM_NAV = [
  { to: '/group', label: 'Project Group', icon: Users, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
];

export default function Layout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  // Auto-close sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-white/10 text-white shadow-sm'
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
    }`;

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:relative z-30 w-60 flex-shrink-0 bg-gray-900 min-h-screen flex flex-col transition-all duration-300 ease-in-out overflow-y-auto`}
      >
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-[-1] lg:hidden"
          />
        )}
        {/* Brand */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight leading-tight text-white truncate">
                Our group's work
              </h1>
              <p className="text-[9px] text-gray-500 leading-tight tracking-widest uppercase truncate">
                Project Management
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all flex-shrink-0 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Personal section */}
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Personal</span>
          </div>
          {PERSONAL_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              title={item.label}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Team section divider */}
          <div className="relative my-4 px-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-900 px-2 text-[9px] font-semibold uppercase tracking-widest text-indigo-400">
                Team Shared
              </span>
            </div>
          </div>

          {/* Team section */}
          {TEAM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 shadow-sm ring-1 ring-indigo-500/30'
                    : 'text-indigo-400/70 hover:bg-indigo-900/20 hover:text-indigo-300'
                }`
              }
              title={item.label}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
          <div className="px-4 py-3 border-t border-gray-800">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{user.display_name || user.username}</p>
                    <p className="text-[9px] text-gray-500">{user.role === 'admin' ? 'Administrator' : 'User'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {user.role === 'admin' && (
                    <button onClick={() => navigate('/admin')}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg px-2 py-1.5 transition-colors">
                      <Shield className="w-3 h-3" /> Admin
                    </button>
                  )}
                  <button onClick={() => logout().then(() => navigate('/login'))}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded-lg px-2 py-1.5 transition-colors">
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
          </div>

        {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-800">
            <p className="text-[10px] text-gray-600 leading-tight">
              &copy; {new Date().getFullYear()}<br />
              Internal Use Only
            </p>
          </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:px-6 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl mr-3 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title from current route */}
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {(() => {
                const path = location.pathname;
                if (path === '/') return 'Dashboard';
                if (path.startsWith('/projects')) return 'Project Dashboard';
                if (path.startsWith('/group')) return 'Project Group';
                if (path.startsWith('/history')) return 'History & Summary';
                if (path.startsWith('/timesheet')) return 'Time Sheet';
                if (path.startsWith('/admin')) return 'User Management';
                if (path.startsWith('/login')) return 'Sign In';
                if (path.startsWith('/calendar')) return 'Team Calendar';
                if (path.startsWith('/project')) return 'Project';
                return 'Our group\'s work';
              })()}
            </h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
