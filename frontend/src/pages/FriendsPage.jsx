import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiX, FiChevronDown, FiUsers } from 'react-icons/fi';
import api from '../services/api';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatCurrency, GROUP_TYPES } from '../utils/formatters';

/**
 * Friends list — every user you share a group with, with cumulative pairwise
 * balance across all shared groups. Click a friend to expand per-group breakdown.
 */
export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | owes-you | you-owe | settled

  useEffect(() => {
    api.get('/users/me/friends')
      .then((r) => setFriends(r.data))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let list = friends;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.user.name.toLowerCase().includes(q) || f.user.email?.toLowerCase().includes(q));
    }
    if (filter === 'owes-you')  list = list.filter((f) => f.totalNet > 0.01);
    if (filter === 'you-owe')   list = list.filter((f) => f.totalNet < -0.01);
    if (filter === 'settled')   list = list.filter((f) => Math.abs(f.totalNet) <= 0.01);
    return list;
  }, [friends, search, filter]);

  const stats = useMemo(() => {
    let owesYou = 0;
    let youOwe = 0;
    for (const f of friends) {
      if (f.totalNet > 0.01) owesYou += f.totalNet;
      else if (f.totalNet < -0.01) youOwe += Math.abs(f.totalNet);
    }
    return { owesYou, youOwe, count: friends.length };
  }, [friends]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-5 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">Friends</h1>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-0.5">Cross-group balances with everyone you split with</p>
      </div>

      {/* Stats summary */}
      {friends.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total friends" value={stats.count} color="text-gray-900 dark:text-dark-text" />
          <Stat label="Owe you" value={formatCurrency(stats.owesYou, 'AED').replace('AED', '').trim()} prefix="+" color="text-emerald-600 dark:text-emerald-400" />
          <Stat label="You owe" value={formatCurrency(stats.youOwe, 'AED').replace('AED', '').trim()} prefix="−" color="text-rose-500 dark:text-rose-400" />
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends by name or email…"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600">
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex bg-gray-100 dark:bg-dark-border rounded-xl p-1 gap-1 overflow-x-auto">
          {[
            { id: 'all',      label: 'All' },
            { id: 'owes-you', label: 'Owe you' },
            { id: 'you-owe',  label: 'You owe' },
            { id: 'settled',  label: 'Settled' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === id
                  ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text shadow-sm'
                  : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty / list */}
      {friends.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border py-16 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center mb-3">
            <FiUsers className="h-7 w-7 text-primary-500" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-dark-text">No friends yet</h3>
          <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">Join or create a group to start splitting with friends.</p>
          <Link to="/groups" className="inline-block mt-4 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">
            + New Group
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border py-12 text-center">
          <p className="text-gray-500 dark:text-dark-muted text-sm">No friends match your filters.</p>
        </div>
      ) : (
        <ul className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden divide-y divide-gray-50 dark:divide-dark-border/50">
          {visible.map((f) => {
            const expanded = expandedId === f.user._id;
            const positive = f.totalNet > 0.01;
            const negative = f.totalNet < -0.01;
            return (
              <li key={f.user._id} className={expanded ? 'bg-gray-50/50 dark:bg-dark-border/10' : ''}>
                <button
                  onClick={() => setExpandedId(expanded ? null : f.user._id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50/80 dark:hover:bg-dark-border/20 transition-colors text-left"
                >
                  <Avatar user={f.user} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-dark-text truncate">{f.user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted truncate">
                      {f.byGroup.length} shared group{f.byGroup.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-extrabold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-rose-500 dark:text-rose-400' : 'text-gray-400'}`}>
                      {positive ? '+' : negative ? '−' : ''}{formatCurrency(Math.abs(f.totalNet), f.byGroup[0]?.currency || 'USD')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">
                      {positive ? 'owes you' : negative ? 'you owe' : 'settled up'}
                    </p>
                  </div>
                  <FiChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {expanded && (
                  <div className="px-5 pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-muted mb-2 mt-1">Per-group breakdown</p>
                    <ul className="space-y-1.5">
                      {f.byGroup.map((g, i) => {
                        const meta = GROUP_TYPES[g.group.type] || GROUP_TYPES.other;
                        const gPos = g.balance > 0.01;
                        const gNeg = g.balance < -0.01;
                        return (
                          <li key={i}>
                            <Link
                              to={`/groups/${g.group._id}`}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-dark-border/30 border border-gray-100 dark:border-dark-border transition"
                            >
                              <span className="text-base flex-shrink-0">{meta.icon}</span>
                              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-dark-text truncate">{g.group.name}</span>
                              <span className={`text-sm font-bold tabular-nums ${gPos ? 'text-emerald-600' : gNeg ? 'text-rose-500' : 'text-gray-400'}`}>
                                {gPos ? '+' : gNeg ? '−' : ''}{formatCurrency(Math.abs(g.balance), g.currency)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, prefix, color }) {
  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-muted">{label}</p>
      <p className={`text-lg font-extrabold tracking-tight tabular-nums mt-0.5 ${color}`}>
        {prefix}{value}
      </p>
    </div>
  );
}
