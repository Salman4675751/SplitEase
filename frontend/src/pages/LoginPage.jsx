import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiMail, FiLock, FiSun, FiMoon } from 'react-icons/fi';
import Logo from '../components/common/Logo';

export default function LoginPage() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50 to-white dark:from-dark-bg dark:to-dark-card">
      {/* Left panel — hero with mesh gradient + decorative rings */}
      <div className="hidden lg:flex lg:w-1/2 mesh-bg grain flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative concentric rings */}
        <div className="absolute inset-0 opacity-[0.08] flex items-center justify-center">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white"
              style={{ width: `${140 + i * 90}px`, height: `${140 + i * 90}px` }}
            />
          ))}
        </div>

        {/* Pulse ring behind logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-white/30 motion-safe:animate-pulse-ring" />
          <div className="relative h-24 w-24 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6 motion-safe:animate-float shadow-glow-lg">
            <Logo size={64} variant="inverse" />
          </div>
        </div>

        <div className="relative text-center text-white max-w-sm mt-2">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 leading-none">SplitEase</h1>
          <p className="text-white/85 text-lg leading-relaxed">
            Track shared expenses, split costs fairly, and settle up effortlessly.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-7">
            {['Equal splits', 'Multi-currency', 'Smart settle-up'].map((f) => (
              <span key={f} className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium text-white/90">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <button
          onClick={toggle}
          className="absolute top-5 right-5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border"
        >
          {dark ? <FiSun className="h-5 w-5 text-gray-500 dark:text-dark-muted" /> : <FiMoon className="h-5 w-5 text-gray-500" />}
        </button>

        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="lg:hidden flex justify-center mb-4">
              <Logo size={48} animated />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">Welcome back</h2>
            <p className="text-gray-500 dark:text-dark-muted mt-1.5 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-600 font-medium hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-dark-muted mt-6">
            No account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
