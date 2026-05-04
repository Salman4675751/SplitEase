import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiArrowRight, FiCopy, FiExternalLink } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, currencyPrefix } from '../../utils/formatters';
import { PAYMENT_TYPES, PAYMENT_TYPE_STYLES, displayValue, whatsappURL, findPhoneMethod } from '../../utils/payment';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';

export default function SettleUpModal({ isOpen, onClose, group, transactions, onSuccess }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipientMethods, setRecipientMethods] = useState(null);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const myTransactions = transactions.filter((t) => t.from._id === user?._id);

  // Reset modal state on close
  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setAmount('');
      setNotes('');
      setRecipientMethods(null);
    }
  }, [isOpen]);

  // When a transaction is picked, fetch recipient's payment methods
  useEffect(() => {
    if (!selected) return setRecipientMethods(null);
    let cancelled = false;
    (async () => {
      setLoadingMethods(true);
      try {
        const { data } = await api.get(`/users/${selected.to._id}/payment-methods`);
        if (!cancelled) setRecipientMethods(data.paymentMethods || []);
      } catch {
        if (!cancelled) setRecipientMethods([]);
      } finally {
        if (!cancelled) setLoadingMethods(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const selectTransaction = (t) => {
    setSelected(t);
    setAmount(t.amount.toFixed(2));
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) return toast.error('Select a transaction to settle');
    if (!amount || parseFloat(amount) <= 0) return toast.error('Enter a valid amount');

    setLoading(true);
    try {
      await api.post('/settlements', {
        groupId: group._id,
        paidTo: selected.to._id,
        amount: parseFloat(amount),
        currency: group.currency,
        notes,
      });
      toast.success(`Payment of ${formatCurrency(parseFloat(amount), group.currency)} to ${selected.to.name} recorded!`);
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Build a WhatsApp message that includes the IBAN/Aani for easy paste
  const buildWhatsappMessage = () => {
    if (!selected || !recipientMethods) return '';
    const amt = formatCurrency(parseFloat(amount || selected.amount), group.currency);
    const lines = [
      `Hi ${selected.to.name.split(' ')[0]}, sending you ${amt} for ${group.name}.`,
    ];
    const defaultMethod = recipientMethods.find((m) => m.isDefault) || recipientMethods[0];
    if (defaultMethod) {
      const meta = PAYMENT_TYPES[defaultMethod.type];
      lines.push(`Transferring to your ${meta?.short || defaultMethod.type}: ${displayValue(defaultMethod)}`);
    }
    lines.push('— ' + (user?.name || ''));
    return lines.join('\n');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settle Up" size="md">
      <div className="space-y-5">
        {myTransactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-semibold text-gray-900 dark:text-dark-text">You're all settled up!</p>
            <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">You don't owe anyone in this group.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-dark-muted mb-3">Who do you want to pay?</p>
              <div className="space-y-2">
                {myTransactions.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectTransaction(t)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition text-left ${
                      selected === t
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-dark-border hover:border-primary-300'
                    }`}
                  >
                    <Avatar user={t.to} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Pay</span>
                        <span className="font-semibold text-gray-900 dark:text-dark-text">{t.to.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">Outstanding balance</p>
                    </div>
                    <span className="text-sm font-bold text-rose-500">{formatCurrency(t.amount, t.currency)}</span>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <>
                {/* Recipient's payment methods card */}
                <div className="rounded-2xl border border-primary-100 dark:border-primary-500/20 bg-gradient-to-br from-primary-50 to-white dark:from-primary-500/5 dark:to-dark-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-primary-100 dark:border-primary-500/20 flex items-center gap-2">
                    <Avatar user={selected.to} size="xs" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                      How to pay {selected.to.name.split(' ')[0]}
                    </p>
                  </div>

                  {loadingMethods ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">Loading…</div>
                  ) : recipientMethods?.length > 0 ? (
                    <ul className="divide-y divide-primary-100/50 dark:divide-primary-500/10">
                      {recipientMethods.map((m, idx) => {
                        const meta = PAYMENT_TYPES[m.type];
                        const styles = PAYMENT_TYPE_STYLES[meta?.color] || PAYMENT_TYPE_STYLES.blue;
                        return (
                          <li key={idx} className="flex items-center gap-3 px-4 py-3">
                            <div className={`h-9 w-9 rounded-xl ${styles} flex items-center justify-center text-base flex-shrink-0`}>
                              {meta?.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-dark-text">{meta?.short}</span>
                                {m.label && <span className="text-[11px] text-gray-500 dark:text-dark-muted">· {m.label}</span>}
                                {m.isDefault && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400">
                                    default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-gray-900 dark:text-dark-text truncate">{displayValue(m)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copy(m.value)}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border hover:border-primary-400 text-xs font-semibold text-gray-700 dark:text-dark-text transition"
                            >
                              <FiCopy className="h-3 w-3" /> Copy
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-4 py-4 text-center text-xs text-gray-500 dark:text-dark-muted">
                      {selected.to.name.split(' ')[0]} hasn't added payment details yet.
                      <br />
                      Ask them to set up payment methods in their profile.
                    </div>
                  )}

                  {/* WhatsApp share — only after payment methods have loaded so we
                      have stable inputs for the prefilled message. */}
                  {!loadingMethods && Array.isArray(recipientMethods) && (
                    <div className="px-4 py-3 bg-white/40 dark:bg-dark-border/20 border-t border-primary-100 dark:border-primary-500/20">
                      <a
                        href={whatsappURL({
                          phone: findPhoneMethod(recipientMethods)?.value,
                          message: buildWhatsappMessage(),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold transition"
                      >
                        <FaWhatsapp className="h-4 w-4" />
                        Send via WhatsApp
                        <FiExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                      <p className="text-[11px] text-gray-500 dark:text-dark-muted text-center mt-1.5">
                        Opens WhatsApp with payment details prefilled
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">
                    Amount paid <span className="text-gray-400">(can be partial)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                      {currencyPrefix(group.currency)}
                    </span>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-14 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Notes (optional)</label>
                  <input
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Paid via Aani transfer"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-border font-medium transition text-sm">
                Cancel
              </button>
              <button type="submit" disabled={loading || !selected}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
                {loading ? 'Recording…' : 'Mark as Paid'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
