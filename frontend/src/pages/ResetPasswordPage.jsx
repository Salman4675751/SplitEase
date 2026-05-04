import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/common/Logo';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary-50 to-white dark:from-dark-bg dark:to-dark-card">
        <div className="max-w-sm text-center bg-white dark:bg-dark-card rounded-2xl p-8 border border-gray-100 dark:border-dark-border">
          <FiAlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-text">Invalid reset link</h2>
          <p className="text-sm text-gray-500 dark:text-dark-muted mt-2">This link is missing a token. Request a new one.</p>
          <Link to="/forgot-password" className="inline-block mt-4 text-primary-600 font-medium hover:underline text-sm">
            Request reset link
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirm) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword: form.newPassword });
      localStorage.setItem('token', data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      updateUser(data.user);
      toast.success('Password reset! You\'re signed in.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white dark:from-dark-bg dark:to-dark-card p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={48} animated />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">Set new password</h2>
          <p className="text-gray-500 dark:text-dark-muted mt-1.5 text-sm">Choose a strong password you haven't used before.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">New Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password" required value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="Min. 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Confirm Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="password" required value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Re-type password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
