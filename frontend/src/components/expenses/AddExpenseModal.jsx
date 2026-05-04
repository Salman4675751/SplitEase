import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiMinus } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES, CURRENCIES, formatCurrency, currencyPrefix } from '../../utils/formatters';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';

const SPLIT_TYPES = [
  { value: 'equal', label: 'Equal', desc: 'Split evenly among all members' },
  { value: 'exact', label: 'Exact', desc: 'Specify exact amounts' },
  { value: 'percentage', label: '%', desc: 'Split by percentage' },
];

export default function AddExpenseModal({ isOpen, onClose, group, onSuccess }) {
  const { user } = useAuth();

  const defaultForm = () => ({
    description: '',
    amount: '',
    currency: group?.currency || 'USD',
    category: 'other',
    splitType: 'equal',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    paidBy: [{ user: user?._id, amount: '' }],
    splits: [],
    isRecurring: false,
    recurringFrequency: 'monthly',
  });

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const members = group?.members || [];

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleAmountChange = (e) => {
    const amount = e.target.value;
    setForm((f) => {
      // Auto-fill single payer amount
      const paidBy = f.paidBy.length === 1
        ? [{ ...f.paidBy[0], amount }]
        : f.paidBy;
      return { ...f, amount, paidBy };
    });
  };

  const setPayer = (userId, amount) => {
    setForm((f) => ({ ...f, paidBy: [{ user: userId, amount: amount || f.amount }] }));
  };

  const setSplitValue = (userId, value) => {
    setForm((f) => {
      const existing = f.splits.find((s) => s.user === userId);
      if (existing) {
        return { ...f, splits: f.splits.map((s) => s.user === userId ? { ...s, ...(f.splitType === 'exact' ? { amount: value } : { percentage: value }) } : s) };
      }
      return { ...f, splits: [...f.splits, { user: userId, ...(f.splitType === 'exact' ? { amount: value } : { percentage: value }) }] };
    });
  };

  const getSplitValue = (userId) => {
    const split = form.splits.find((s) => s.user === userId);
    return form.splitType === 'exact' ? split?.amount || '' : split?.percentage || '';
  };

  const splitTotal = () => {
    if (form.splitType === 'exact') return form.splits.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
    if (form.splitType === 'percentage') return form.splits.reduce((s, x) => s + parseFloat(x.percentage || 0), 0);
    return 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount');

    const paidBy = form.paidBy.map((p) => ({
      user: p.user,
      amount: parseFloat(p.amount) || parseFloat(form.amount),
    }));

    let splits = form.splits;
    if (form.splitType === 'equal') splits = [];

    setLoading(true);
    try {
      // Combine the picked date with a real time-of-day so the timestamp
      // reflects the user's local moment (avoids "19h ago" right after creation
      // when the backend would otherwise store UTC midnight of the date).
      const todayStr = new Date().toISOString().split('T')[0];
      let isoDate;
      if (form.date === todayStr) {
        isoDate = new Date().toISOString(); // full current local timestamp
      } else {
        // Past/future dates: anchor at noon local to avoid TZ drift across days
        const [y, m, d] = form.date.split('-').map(Number);
        isoDate = new Date(y, m - 1, d, 12, 0, 0).toISOString();
      }

      await api.post('/expenses', {
        groupId: group._id,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        category: form.category,
        splitType: form.splitType,
        paidBy,
        splits,
        notes: form.notes,
        date: isoDate,
        isRecurring: form.isRecurring,
        recurringFrequency: form.isRecurring ? form.recurringFrequency : undefined,
      });
      toast.success('Expense added!');
      setForm(defaultForm());
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pctTotal = splitTotal();
  const exactTotal = splitTotal();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense" size="lg">
      <form onSubmit={submit} className="space-y-5">
        {/* Description + Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Description *</label>
            <input name="description" required value={form.description} onChange={handle} placeholder="Dinner, groceries…"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Amount *</label>
            <div className="flex">
              <select name="currency" value={form.currency} onChange={handle}
                className="px-3 py-2.5 rounded-l-xl border border-r-0 border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-border text-gray-700 dark:text-dark-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                  <option key={code} value={code}>{symbol}</option>
                ))}
              </select>
              <input name="amount" type="number" step="0.01" min="0.01" required value={form.amount} onChange={handleAmountChange}
                placeholder="0.00"
                className="flex-1 px-4 py-2.5 rounded-r-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        {/* Category + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Category</label>
            <select name="category" value={form.category} onChange={handle}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm">
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Date</label>
            <input name="date" type="date" value={form.date} onChange={handle}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" />
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = form.paidBy.some((p) => p.user === m.user._id);
              return (
                <button
                  key={m.user._id}
                  type="button"
                  onClick={() => setPayer(m.user._id, form.amount)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                    isSelected
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:border-primary-400'
                  }`}
                >
                  <Avatar user={m.user} size="xs" />
                  {m.user.name} {m.user._id === user?._id && '(you)'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Split type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Split</label>
          <div className="flex bg-gray-100 dark:bg-dark-border rounded-xl p-1 gap-1 mb-4">
            {SPLIT_TYPES.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, splitType: st.value, splits: [] }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  form.splitType === st.value
                    ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text shadow-sm'
                    : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {form.splitType === 'equal' && form.amount && (
            <p className="text-sm text-gray-500 dark:text-dark-muted text-center">
              {formatCurrency(parseFloat(form.amount) / members.length, form.currency)} each among {members.length} members
            </p>
          )}

          {(form.splitType === 'exact' || form.splitType === 'percentage') && (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user._id} className="flex items-center gap-3">
                  <Avatar user={m.user} size="sm" />
                  <span className="text-sm text-gray-700 dark:text-dark-text flex-1">{m.user.name}</span>
                  <div className="relative">
                    <input
                      type="number" step="0.01" min="0"
                      value={getSplitValue(m.user._id)}
                      onChange={(e) => setSplitValue(m.user._id, e.target.value)}
                      placeholder={form.splitType === 'percentage' ? '0' : '0.00'}
                      className="w-28 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                      {form.splitType === 'percentage' ? '%' : currencyPrefix(form.currency)}
                    </span>
                  </div>
                </div>
              ))}
              <div className={`text-right text-sm font-medium mt-1 ${
                form.splitType === 'percentage'
                  ? (Math.abs(pctTotal - 100) < 0.01 ? 'text-emerald-600' : 'text-rose-500')
                  : (form.amount && Math.abs(exactTotal - parseFloat(form.amount)) < 0.01 ? 'text-emerald-600' : 'text-rose-500')
              }`}>
                Total: {form.splitType === 'percentage' ? `${pctTotal.toFixed(1)}% / 100%` : `${formatCurrency(exactTotal, form.currency)} / ${formatCurrency(parseFloat(form.amount) || 0, form.currency)}`}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Notes (optional)</label>
          <textarea name="notes" value={form.notes} onChange={handle} rows={2} placeholder="Any additional details…"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm" />
        </div>

        {/* Recurring */}
        <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-border/20 px-4 py-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-dark-text flex items-center gap-1.5">
                🔁 Make this recurring
              </p>
              <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                Auto-create this expense on a schedule (e.g. rent, gym, Netflix)
              </p>
            </div>
            {form.isRecurring && (
              <select
                value={form.recurringFrequency}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setForm((f) => ({ ...f, recurringFrequency: e.target.value }))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-sm font-medium text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-border font-medium transition text-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
            {loading ? 'Adding…' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
