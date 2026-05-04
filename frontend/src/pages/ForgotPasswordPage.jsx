import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMail, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import Logo from '../components/common/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
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

        {!sent ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">Forgot password?</h2>
              <p className="text-gray-500 dark:text-dark-muted mt-1.5 text-sm">No worries — we'll send you reset instructions.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-8 animate-fadein">
            <FiCheckCircle className="h-14 w-14 mx-auto text-primary-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Check your email</h2>
            <p className="text-sm text-gray-500 dark:text-dark-muted mt-2">
              If <strong>{email}</strong> is registered with us, we've sent a password reset link.
            </p>
            <p className="text-xs text-gray-400 dark:text-dark-muted mt-3">
              The link expires in 1 hour. Don't see it? Check spam.
            </p>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary-600 font-medium hover:underline">
            <FiArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
