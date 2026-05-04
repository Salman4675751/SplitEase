import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch, FiX, FiChevronDown, FiFilter, FiRefreshCw } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatRelativeDate, CATEGORIES } from '../utils/formatters';
import Avatar from '../components/common/Avatar';
import CategoryIcon from '../components/common/CategoryIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * Cross-group expense browser with search + filters.
 * Backed by GET /expenses with query string params.
 */
export default function AllExpensesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Read filters from URL — keeps them shareable + back-button friendly
  const q         = params.get('q') || '';
  const category  = params.get('category') || '';
  const groupId   = params.get('groupId') || '';
  const from      = params.get('from') || '';
  const to        = params.get('to') || '';
  const minAmount = params.get('minAmount') || '';
  const maxAmount = params.get('maxAmount') || '';
  const sort      = params.get('sort') || 'date';

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const clearFilters = () => setParams({}, { replace: true });

  // Fetch user's groups once for the group dropdown
  useEffect(() => {
    api.get('/groups').then((r) => setGroups(r.data)).catch(() => {});
  }, []);

  // Fetch expenses whenever filters change
  useEffect(() => {
    setLoading(true);
    const query = {};
    if (q) query.q = q;
    if (category) query.category = category;
    if (groupId) query.groupId = groupId;
    if (from) query.from = from;
    if (to) query.to = to;
    if (minAmount) query.minAmount = minAmount;
    if (maxAmount) query.maxAmount = maxAmount;
    if (sort) query.sort = sort;

    api.get('/expenses', { params: query })
      .then((r) => setExpenses(r.data))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, [q, category, groupId, from, to, minAmount, maxAmount, sort]);

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const activeFilterCount = [category, groupId, from, to, minAmount, maxAmount].filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">All Expenses</h1>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-0.5">Search and filter across every group you're in</p>
      </div>

      {/* Search bar + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search expenses by description…"
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {q && (
            <button onClick={() => setParam('q', '')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600">
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-semibold text-sm transition ${
            activeFilterCount > 0 || showFilters
              ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-500/10 dark:border-primary-500/30 dark:text-primary-400'
              : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-muted hover:border-gray-300'
          }`}
        >
          <FiFilter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-primary-600 text-white">{activeFilterCount}</span>
          )}
          <FiChevronDown className={`h-3.5 w-3.5 transition ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fadein">
          <Field label="Group">
            <select value={groupId} onChange={(e) => setParam('groupId', e.target.value)} className={selectClass}>
              <option value="">All groups</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Field>

          <Field label="Category">
            <select value={category} onChange={(e) => setParam('category', e.target.value)} className={selectClass}>
              <option value="">All categories</option>
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Sort by">
            <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className={selectClass}>
              <option value="date">Date (newest first)</option>
              <option value="amount">Amount (highest first)</option>
            </select>
          </Field>

          <Field label="From date">
            <input type="date" value={from} onChange={(e) => setParam('from', e.target.value)} className={selectClass} />
          </Field>
          <Field label="To date">
            <input type="date" value={to} onChange={(e) => setParam('to', e.target.value)} className={selectClass} />
          </Field>

          <Field label="Amount range">
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01" value={minAmount} onChange={(e) => setParam('minAmount', e.target.value)} placeholder="Min" className={selectClass} />
              <input type="number" min="0" step="0.01" value={maxAmount} onChange={(e) => setParam('maxAmount', e.target.value)} placeholder="Max" className={selectClass} />
            </div>
          </Field>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-dark-muted hover:text-rose-500 transition">
              <FiRefreshCw className="h-3 w-3" /> Clear all filters
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-gray-500 dark:text-dark-muted">
          {loading ? 'Loading…' : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} found`}
        </p>
        {expenses.length > 0 && (
          <p className="font-bold text-gray-900 dark:text-dark-text tabular-nums">
            Total: {formatCurrency(totalAmount, expenses[0]?.currency || user?.currency)}
          </p>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>
      ) : expenses.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border py-16 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-semibold text-gray-700 dark:text-dark-text">No expenses match</h3>
          <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <ul className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden divide-y divide-gray-50 dark:divide-dark-border/50">
          {expenses.map((exp) => {
            const myPaid = exp.paidBy?.find((p) => p.user?._id === user?._id);
            const mySplit = exp.splits?.find((s) => s.user?._id === user?._id);
            const myShare = mySplit?.amount || 0;
            const myPaidAmt = myPaid?.amount || 0;
            const myNet = myPaidAmt - myShare;

            return (
              <li key={exp._id}>
                <Link to={`/groups/${exp.group?._id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-dark-border/20 transition-colors">
                  <CategoryIcon category={exp.category} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{exp.description}</p>
                      {exp.isRecurring && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                          🔁 {exp.recurringFrequency}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-dark-muted truncate">
                      {exp.group?.name} · {formatRelativeDate(exp.date)} · {exp.paidBy?.map((p) => p.user?.name?.split(' ')[0]).join(', ')} paid
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-dark-text tabular-nums">{formatCurrency(exp.amount, exp.currency)}</p>
                    {myPaidAmt > 0 && myNet > 0.01 ? (
                      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        +{formatCurrency(myNet, exp.currency)}
                      </span>
                    ) : myPaidAmt > 0 ? (
                      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        you paid
                      </span>
                    ) : myShare > 0.01 ? (
                      <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                        {formatCurrency(myShare, exp.currency)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const selectClass = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
