import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Cog, Clock } from 'lucide-react';


interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-gray-900 text-white shadow-sm'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight text-gray-900">
                T. Theera's Work
              </h1>
              <p className="text-[10px] text-gray-400 leading-tight tracking-widest uppercase">
                Project Management
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
            <NavLink to="/" className={linkClass} end>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </NavLink>
            <NavLink to="/history" className={linkClass}>
              <History className="w-4 h-4" />
              History
            </NavLink>
            <NavLink to="/timesheet" className={linkClass}>
              <Clock className="w-4 h-4" />
              Time Sheet
            </NavLink>

          </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6 max-w-screen-2xl mx-auto w-full">
        {children}
      </main>

      <footer className="text-center text-[11px] text-gray-400 py-3 border-t border-gray-200 bg-white">
        &copy; {new Date().getFullYear()} &nbsp;T. Theera Project Management &mdash; Internal Use Only
      </footer>
    </div>
  );
}
