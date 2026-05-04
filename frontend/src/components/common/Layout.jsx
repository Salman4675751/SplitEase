import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  FiHome, FiUsers, FiUser, FiLogOut, FiSun, FiMoon, FiMenu, FiX, FiBell,
  FiList, FiActivity, FiUserCheck,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from './Avatar';
import Logo from './Logo';

const navItems = [
  { to: '/dashboard', icon: FiHome,       label: 'Dashboard' },
  { to: '/groups',    icon: FiUsers,      label: 'Groups' },
  { to: '/friends',   icon: FiUserCheck,  label: 'Friends' },
  { to: '/expenses',  icon: FiList,       label: 'All Expenses' },
  { to: '/activity',  icon: FiActivity,   label: 'Activity' },
  { to: '/profile',   icon: FiUser,       label: 'Profile' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const unreadCount = user?.notifications?.filter((n) => !n.read).length || 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-bg overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border
          flex flex-col z-30 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static`}
      >
        {/* Logo */}
        <div className="flex items-center px-6 py-5 border-b border-gray-100 dark:border-dark-border">
          <Logo size={34} withText />
          <button
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border"
            onClick={() => setSidebarOpen(false)}
          >
            <FiX className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-border hover:text-gray-900 dark:hover:text-dark-text'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user section */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-dark-border space-y-1">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
          >
            {dark ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-dark-muted hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
          >
            <FiLogOut className="h-5 w-5" />
            Sign Out
          </button>

          <div className="flex items-center gap-3 px-3 py-2 mt-2">
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-dark-muted truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-dark-card border-b border-gray-100 dark:border-dark-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border"
          >
            <FiMenu className="h-5 w-5 text-gray-600 dark:text-dark-muted" />
          </button>
          <Logo size={26} withText />

          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border">
              {dark ? <FiSun className="h-5 w-5 text-gray-600 dark:text-dark-muted" /> : <FiMoon className="h-5 w-5 text-gray-600" />}
            </button>
            <div className="relative">
              <FiBell className="h-5 w-5 text-gray-600 dark:text-dark-muted" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
