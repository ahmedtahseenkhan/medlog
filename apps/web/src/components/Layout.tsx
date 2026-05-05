import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { LayoutDashboard, Users, LogOut, Activity, BarChart2, ShieldCheck, Settings, GitMerge, FileText, Calendar } from 'lucide-react'
import clsx from 'clsx'
import NotificationBell from './notifications/NotificationBell'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/consults', label: 'Consults', icon: GitMerge },
  { to: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
]

const ADMIN_NAV = [
  { to: '/audit-log', label: 'Audit log', icon: ShieldCheck },
]

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'CONSULTANT'
  const navItems = [...NAV_ITEMS, ...(isAdmin ? ADMIN_NAV : [])]

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Activity className="text-brand-500 w-5 h-5" />
          <span className="font-semibold text-gray-900">MedLog AI</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <NavLink to="/settings"
            className={({ isActive }) => clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1', isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100')}>
            <Settings className="w-4 h-4" /> Settings
          </NavLink>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-40">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
