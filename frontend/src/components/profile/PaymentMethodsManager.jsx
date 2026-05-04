import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiStar, FiCopy } from 'react-icons/fi';
import api from '../../services/api';
import { PAYMENT_TYPES, PAYMENT_TYPE_STYLES, displayValue } from '../../utils/payment';

/**
 * UI for managing the current user's "how others pay you" methods.
 *
 * Reads from `user.paymentMethods` directly (no local mirror) so the list
 * always reflects auth-context truth — including after page refresh when
 * `/auth/me` rehydrates the user.
 */
export default function PaymentMethodsManager({ user, onUpdate }) {
  const methods = user?.paymentMethods || [];
  const [draft, setDraft] = useState({ type: 'iban', label: '', value: '' });
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    setSaving(true);
    try {
      const { data } = await api.put('/users/me/payment-methods', { paymentMethods: next });
      onUpdate?.(data.paymentMethods);
      toast.success('Payment methods updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addMethod = (e) => {
    e.preventDefault();
    if (!draft.value.trim()) return toast.error('Enter a value');
    const next = [
      ...methods,
      {
        type: draft.type,
        label: draft.label.trim(),
        value: draft.value.trim(),
        isDefault: methods.length === 0, // first method is default
      },
    ];
    setDraft({ type: 'iban', label: '', value: '' });
    persist(next);
  };

  const removeMethod = (idx) => {
    if (!confirm('Remove this payment method?')) return;
    const next = methods.filter((_, i) => i !== idx);
    // If we removed the default, promote the first remaining
    if (methods[idx]?.isDefault && next.length > 0) next[0].isDefault = true;
    persist(next);
  };

  const setDefault = (idx) => {
    const next = methods.map((m, i) => ({ ...m, isDefault: i === idx }));
    persist(next);
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const typeMeta = PAYMENT_TYPES[draft.type];

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-dark-text">How others pay you</h3>
          <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
            Group members will see these when they settle up. Money goes directly to your bank — SplitEase never holds funds.
          </p>
        </div>
      </div>

      {/* Existing methods */}
      {methods.length > 0 && (
        <ul className="mt-4 space-y-2">
          {methods.map((m, idx) => {
            const meta = PAYMENT_TYPES[m.type];
            const styles = PAYMENT_TYPE_STYLES[meta?.color] || PAYMENT_TYPE_STYLES.blue;
            return (
              <li key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-border/20 group/method">
                <div className={`h-9 w-9 rounded-xl ${styles} flex items-center justify-center text-base flex-shrink-0`}>
                  {meta?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-dark-text">{meta?.short || m.type}</span>
                    {m.label && <span className="text-xs text-gray-500 dark:text-dark-muted">· {m.label}</span>}
                    {m.isDefault && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                        default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-dark-muted font-mono truncate">{displayValue(m)}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => copy(m.value)} title="Copy" className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">
                    <FiCopy className="h-3.5 w-3.5" />
                  </button>
                  {!m.isDefault && (
                    <button onClick={() => setDefault(idx)} title="Make default" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
                      <FiStar className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => removeMethod(idx)} title="Remove" disabled={saving} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition disabled:opacity-50">
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add new */}
      <form onSubmit={addMethod} className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-muted">Add new method</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(PAYMENT_TYPES).map(([key, meta]) => (
            <button
              type="button"
              key={key}
              onClick={() => setDraft((d) => ({ ...d, type: key }))}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition text-center ${draft.type === key
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : 'border-gray-100 dark:border-dark-border hover:border-gray-200 dark:hover:border-dark-muted'}`}
            >
              <span className="text-xl">{meta.icon}</span>
              <span className={`text-xs font-semibold ${draft.type === key ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-dark-text'}`}>{meta.short}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Label (optional, e.g. Mashreq main)"
            className="sm:col-span-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
          <input
            type="text"
            required
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
            placeholder={typeMeta?.placeholder}
            className="sm:col-span-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-mono"
          />
        </div>
        {typeMeta?.hint && (
          <p className="text-[11px] text-gray-400 dark:text-dark-muted -mt-1">ⓘ {typeMeta.hint}</p>
        )}

        <button
          type="submit"
          disabled={saving || !draft.value.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold transition"
        >
          <FiPlus className="h-4 w-4" /> Add Method
        </button>
      </form>
    </div>
  );
}
