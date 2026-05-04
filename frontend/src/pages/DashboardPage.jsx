import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTrendingUp, FiTrendingDown, FiPieChart, FiPlus, FiClock, FiInbox } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatRelativeDate, CATEGORIES, GROUP_TYPES } from '../utils/formatters';
import Avatar from '../components/common/Avatar';
import CategoryIcon from '../components/common/CategoryIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';

function StatCard({ label, amount, currency, type, icon: Icon }) {
  const colors = {
    owed:   'from-emerald-500 to-teal-600',
    owing:  'from-rose-500 to-red-600',
    net:    'from-primary-500 to-primary-700',
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colors[type]} p-5 text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{label}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(amount, currency)}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/balance-summary'),
      api.get('/expenses'),
      api.get('/groups'),
    ]).then(([s, e, g]) => {
      setSummary(s.data);
      setExpenses(e.data.slice(0, 8));
      setGroups(g.data.slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  const currency = user?.currency || 'USD';

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-0.5">Here's your expense overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="You are owed" amount={summary?.totalOwed || 0} currency={currency} type="owed" icon={FiTrendingUp} />
        <StatCard label="You owe" amount={summary?.totalOwing || 0} currency={currency} type="owing" icon={FiTrendingDown} />
        <StatCard label="Net balance" amount={summary?.netBalance || 0} currency={currency} type="net" icon={FiPieChart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent expenses */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <FiClock className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-dark-text">Recent Expenses</h2>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="py-14 text-center px-6">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-3">
                <FiInbox className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="text-gray-700 dark:text-dark-text font-semibold text-sm">Nothing to track yet</h3>
              <p className="text-gray-500 dark:text-dark-muted text-xs mt-1">Create a group to start splitting.</p>
              <Link to="/groups" className="inline-block mt-3 px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition">
                + New Group
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-dark-border/50">
              {expenses.map((exp) => {
                const myPaid = exp.paidBy?.find((p) => p.user?._id === user?._id);
                const mySplit = exp.splits?.find((s) => s.user?._id === user?._id);
                const myShare = mySplit?.amount || 0;
                const myPaidAmt = myPaid?.amount || 0;
                const myNet = myPaidAmt - myShare;

                return (
                  <li key={exp._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-dark-border/20 transition-colors">
                    <CategoryIcon category={exp.category} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{exp.description}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted truncate">
                        {exp.group?.name} · {formatRelativeDate(exp.date)}
                      </p>
                    </div>
                    <div className="text-right">
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Groups sidebar */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
            <h2 className="font-semibold text-gray-900 dark:text-dark-text">Your Groups</h2>
            <Link to="/groups" className="text-xs text-primary-600 font-medium hover:underline">See all</Link>
          </div>

          {groups.length === 0 ? (
            <div className="py-10 text-center text-gray-400 dark:text-dark-muted px-4">
              <p className="text-sm">No groups yet.</p>
              <Link to="/groups" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">
                + Create a group
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-dark-border">
              {groups.map((g) => (
                <li key={g._id}>
                  <Link
                    to={`/groups/${g._id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-lg">
                      {g.type === 'trip' ? '✈️' : g.type === 'home' ? '🏠' : g.type === 'office' ? '💼' : '👥'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{g.name}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">{g.members?.length} members</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="px-5 py-4 border-t border-gray-100 dark:border-dark-border">
            <Link
              to="/groups"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              <FiPlus className="h-4 w-4" /> New Group
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
