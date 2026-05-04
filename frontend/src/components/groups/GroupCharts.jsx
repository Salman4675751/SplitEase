import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { CATEGORIES, formatCurrency } from '../../utils/formatters';

/**
 * Visual breakdowns for the group:
 *   - Donut chart: spending by category
 *   - Bar chart: monthly spending trend
 *   - Bar chart: who paid how much (contribution)
 */
export default function GroupCharts({ expenses, group, members }) {
  const currency = group?.currency || 'USD';

  // Brand-aligned palette
  const COLORS = ['#00b894', '#26d0ad', '#00876b', '#0ea5e9', '#a855f7', '#ec4899', '#f59e0b', '#64748b'];

  // ─── Aggregations ──────────────────────────────────────────

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      const k = e.category || 'other';
      map.set(k, (map.get(k) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({
        name: CATEGORIES[k]?.label || k,
        value: Math.round(v * 100) / 100,
        icon: CATEGORIES[k]?.icon || '📦',
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byMonth = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(k, (map.get(k) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const [, m] = k.split('-');
        const monthName = new Date(2000, parseInt(m, 10) - 1).toLocaleString('en-US', { month: 'short' });
        return { name: monthName, total: Math.round(v * 100) / 100 };
      });
  }, [expenses]);

  const byPayer = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      for (const p of e.paidBy || []) {
        const id = p.user?._id || p.user;
        const name = p.user?.name || members?.find((m) => m.user?._id === id)?.user?.name || '—';
        map.set(name, (map.get(name) || 0) + p.amount);
      }
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name: name.split(' ')[0], total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, members]);

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="font-bold text-gray-700 dark:text-dark-text">No data to chart yet</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">Add expenses to see spending insights.</p>
      </div>
    );
  }

  // Custom dark/light tooltip
  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
      <div className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs shadow-lg">
        <div className="font-semibold">{p.payload.name}</div>
        <div className="font-bold text-base mt-0.5">{formatCurrency(p.value, currency)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* By category donut */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-dark-text">Spending by category</h3>
            <p className="text-xs text-gray-500 dark:text-dark-muted">Where your group spends the most</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-dark-border dark:text-dark-muted">
            {byCategory.length} categories
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut */}
          <div className="relative h-56 w-56 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-muted">Total</div>
              <div className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-dark-text">{formatCurrency(grandTotal, currency)}</div>
            </div>
          </div>

          {/* Legend */}
          <ul className="flex-1 space-y-2 w-full">
            {byCategory.map((c, i) => {
              const pct = grandTotal > 0 ? (c.value / grandTotal) * 100 : 0;
              return (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-base">{c.icon}</span>
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-dark-text truncate">{c.name}</span>
                  <span className="text-xs text-gray-500 dark:text-dark-muted tabular-nums">{pct.toFixed(0)}%</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-dark-text tabular-nums w-20 text-right">{formatCurrency(c.value, currency)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 sm:p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 dark:text-dark-text">Monthly spending</h3>
          <p className="text-xs text-gray-500 dark:text-dark-muted">Group total each month</p>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0, 184, 148, 0.08)' }} />
              <defs>
                <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#26d0ad" />
                  <stop offset="100%" stopColor="#00876b" />
                </linearGradient>
              </defs>
              <Bar dataKey="total" fill="url(#bar-grad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top payers */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 sm:p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 dark:text-dark-text">Who's paid the most</h3>
          <p className="text-xs text-gray-500 dark:text-dark-muted">Total contributed by each member</p>
        </div>
        <ul className="space-y-3">
          {byPayer.map((p, i) => {
            const pct = byPayer[0].total > 0 ? (p.total / byPayer[0].total) * 100 : 0;
            return (
              <li key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-dark-muted tabular-nums w-5">{i + 1}.</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-dark-text">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-dark-text tabular-nums">{formatCurrency(p.total, currency)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-dark-border overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
