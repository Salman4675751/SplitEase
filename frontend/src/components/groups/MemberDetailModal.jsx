import { FiMail, FiArrowRight } from 'react-icons/fi';
import Modal from '../common/Modal';
import Avatar from '../common/Avatar';
import { formatCurrency } from '../../utils/formatters';

/**
 * Click on a member → see who they owe / who owes them within this group.
 * Driven entirely by the simplified transaction list the backend already
 * returns, so no extra API call needed.
 */
export default function MemberDetailModal({ isOpen, onClose, member, balances, transactions, currency, currentUserId }) {
  if (!member) return null;

  const balance = balances?.find((b) => b.user?._id === member._id);
  const netAmt = balance?.amount || 0;

  const owes = transactions?.filter((t) => t.from?._id === member._id) || [];
  const owed = transactions?.filter((t) => t.to?._id === member._id) || [];

  const isMe = member._id === currentUserId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="md">
      <div className="-mt-2">
        {/* Header — avatar + name + email */}
        <div className="flex items-center gap-4 pb-5 border-b border-gray-100 dark:border-dark-border">
          <Avatar user={member} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">{member.name}</h3>
              {isMe && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                  you
                </span>
              )}
            </div>
            {member.email && (
              <p className="text-sm text-gray-500 dark:text-dark-muted flex items-center gap-1.5 mt-0.5 truncate">
                <FiMail className="h-3 w-3 flex-shrink-0" /> {member.email}
              </p>
            )}
          </div>
        </div>

        {/* Net balance */}
        <div className="py-4 border-b border-gray-100 dark:border-dark-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-muted">
            Net balance in this group
          </p>
          <p className={`text-2xl font-extrabold tracking-tight tabular-nums mt-1 ${netAmt > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : netAmt < -0.01 ? 'text-rose-500 dark:text-rose-400' : 'text-gray-900 dark:text-dark-text'}`}>
            {netAmt > 0.01 ? '+' : netAmt < -0.01 ? '−' : ''}{formatCurrency(Math.abs(netAmt), currency)}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
            {netAmt > 0.01
              ? `${isMe ? 'You get' : `${member.name.split(' ')[0]} gets`} back from the group`
              : netAmt < -0.01
                ? `${isMe ? 'You owe' : `${member.name.split(' ')[0]} owes`} the group`
                : 'All settled up'}
          </p>
        </div>

        {/* Gets back from list */}
        {owed.length > 0 && (
          <div className="py-4 border-b border-gray-100 dark:border-dark-border">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2.5">
              {isMe ? 'You get' : `${member.name.split(' ')[0]} gets`} back from
            </p>
            <ul className="space-y-2">
              {owed.map((t, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5">
                  <Avatar user={t.from} size="xs" />
                  <span className="flex-1 text-sm text-gray-900 dark:text-dark-text font-medium">{t.from.name}</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(t.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Owes list */}
        {owes.length > 0 && (
          <div className="py-4 border-b border-gray-100 dark:border-dark-border last:border-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2.5">
              {isMe ? 'You owe' : `${member.name.split(' ')[0]} owes`}
            </p>
            <ul className="space-y-2">
              {owes.map((t, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-rose-50/60 dark:bg-rose-500/5">
                  <Avatar user={t.to} size="xs" />
                  <span className="flex-1 text-sm text-gray-900 dark:text-dark-text font-medium flex items-center gap-1.5">
                    <FiArrowRight className="h-3 w-3 text-gray-400" /> {t.to.name}
                  </span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCurrency(t.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {owes.length === 0 && owed.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">
              {isMe ? 'You are all settled up' : `${member.name.split(' ')[0]} is all settled up`}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">No outstanding transactions</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
