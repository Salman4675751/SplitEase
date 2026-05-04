import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiLock, FiBell, FiCheck, FiCreditCard, FiSun, FiMoon, FiDroplet } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme, COLOR_THEMES } from '../context/ThemeContext';
import { CURRENCIES, formatRelativeDate } from '../utils/formatters';
import Avatar from '../components/common/Avatar';
import PaymentMethodsManager from '../components/profile/PaymentMethodsManager';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { dark, toggle: toggleDark, colorTheme, setColorTheme } = useTheme();
  const [profile, setProfile] = useState({ name: '', avatar: '', currency: 'USD' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notifications, setNotifications] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', avatar: user.avatar || '', currency: user.currency || 'USD' });
      setNotifications(user.notifications?.slice().reverse() || []);
    }
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', profile);
      updateUser(data);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwdForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingPwd(true);
    try {
      await api.put('/users/password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('Password changed!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPwd(false);
    }
  };

  const markNotificationsRead = async () => {
    try {
      await api.put('/users/notifications/read');
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
      updateUser({ notifications: (user.notifications || []).map((n) => ({ ...n, read: true })) });
    } catch {}
  };

  const field = (label, name, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">{label}</label>
      <input
        name={name} type={type} value={name === 'currentPassword' || name === 'newPassword' || name === 'confirmPassword' ? pwdForm[name] : profile[name]}
        onChange={(e) =>
          name === 'currentPassword' || name === 'newPassword' || name === 'confirmPassword'
            ? setPwdForm((f) => ({ ...f, [name]: e.target.value }))
            : setProfile((f) => ({ ...f, [name]: e.target.value }))
        }
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6 animate-fadein">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Profile & Settings</h1>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 dark:bg-dark-border rounded-xl p-1 gap-1 overflow-x-auto">
        {[
          { id: 'profile', icon: FiEdit2, label: 'Profile' },
          { id: 'payment', icon: FiCreditCard, label: 'Payments' },
          { id: 'appearance', icon: FiDroplet, label: 'Appearance' },
          { id: 'security', icon: FiLock, label: 'Security' },
          { id: 'notifications', icon: FiBell, label: `Alerts${notifications.filter((n) => !n.read).length > 0 ? ` (${notifications.filter((n) => !n.read).length})` : ''}` },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
              tab === id ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text shadow-sm' : 'text-gray-500 dark:text-dark-muted'
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar user={user} size="xl" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-dark-text">{user?.name}</p>
              <p className="text-sm text-gray-500 dark:text-dark-muted">{user?.email}</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            {field('Full Name', 'name', 'text', 'Your name')}
            {field('Avatar URL', 'avatar', 'url', 'https://...')}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Default Currency</label>
              <select name="currency" value={profile.currency} onChange={(e) => setProfile((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                  <option key={code} value={code}>{symbol} {code} — {name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={savingProfile}
                className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payment' && (
        <PaymentMethodsManager
          user={user}
          onUpdate={(paymentMethods) => updateUser({ ...user, paymentMethods })}
        />
      )}

      {/* Appearance tab */}
      {tab === 'appearance' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 sm:p-6 space-y-6 shadow-sm">
          {/* Mode */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-dark-text">Display mode</h3>
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5 mb-3">Choose between light and dark interface</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'light', label: 'Light', icon: FiSun, active: !dark },
                { id: 'dark',  label: 'Dark',  icon: FiMoon, active: dark },
              ].map(({ id, label, icon: Icon, active }) => (
                <button
                  key={id}
                  onClick={() => { if (active !== true) toggleDark(); }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                    active
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                      : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    id === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-slate-800 text-slate-200'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-dark-text">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">{id === 'light' ? 'Bright and clean' : 'Easy on the eyes'}</p>
                  </div>
                  {active && <FiCheck className="h-5 w-5 text-primary-600 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Color theme */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-dark-text">Color theme</h3>
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5 mb-3">Pick the accent color for buttons, links, and brand elements</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLOR_THEMES.map((t) => {
                const active = t.id === colorTheme;
                return (
                  <button
                    key={t.id}
                    onClick={() => setColorTheme(t.id)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                      active
                        ? 'border-gray-900 dark:border-white shadow-md'
                        : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'
                    }`}
                  >
                    <div className="relative">
                      <div className="h-12 w-12 rounded-2xl shadow-md" style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.swatch}cc)` }} />
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shadow">
                            <FiCheck className="h-3.5 w-3.5 text-gray-900" />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-dark-text">{t.label}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-dark-muted mt-3 text-center italic">
              {COLOR_THEMES.find((t) => t.id === colorTheme)?.desc}
            </p>
          </div>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-6">
          <h2 className="font-semibold text-gray-900 dark:text-dark-text mb-5">Change Password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            {field('Current Password', 'currentPassword', 'password', '••••••••')}
            {field('New Password', 'newPassword', 'password', 'Min. 6 characters')}
            {field('Confirm New Password', 'confirmPassword', 'password', '••••••••')}
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={savingPwd}
                className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
                {savingPwd ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
            <h2 className="font-semibold text-gray-900 dark:text-dark-text">Notifications</h2>
            {notifications.some((n) => !n.read) && (
              <button onClick={markNotificationsRead}
                className="flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:underline">
                <FiCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-dark-muted">
              <FiBell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-dark-border">
              {notifications.map((n, i) => (
                <li key={i} className={`flex items-start gap-3 px-5 py-4 ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                  <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-border'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-dark-text">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{formatRelativeDate(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
