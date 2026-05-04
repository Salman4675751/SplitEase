import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, CATEGORIES, GROUP_TYPES } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Logo from '../components/common/Logo';

/**
 * Print-optimised group report.
 * Renders without the app chrome (no sidebar, no nav). Auto-fires the
 * browser's print dialog on mount so users can save it as PDF directly.
 *
 * The print stylesheet (see <style> below) hides the action bar and tweaks
 * spacing/colors for paper.
 */
export default function GroupReportPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/groups/${id}`),
      api.get(`/groups/${id}/expenses`),
      api.get(`/groups/${id}/balances`),
      api.get(`/groups/${id}/settlements`),
    ])
      .then(([g, e, b, s]) => setData({
        group: g.data,
        expenses: e.data,
        balances: b.data.balances,
        transactions: b.data.transactions,
        settlements: s.data,
      }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="p-8 text-center">Could not load report.</div>;

  const { group, expenses, balances, transactions, settlements } = data;
  const groupType = GROUP_TYPES[group.type] || GROUP_TYPES.other;
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-break-inside-avoid { break-inside: avoid; }
          @page { size: A4; margin: 14mm; }
        }
        @media screen {
          .report-page { max-width: 820px; margin: 0 auto; padding: 32px 24px 60px; }
        }
      `}</style>

      {/* Action bar (screen only) */}
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <FiArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition"
        >
          <FiPrinter className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <div className="report-page">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <div>
            <Logo size={32} withText />
            <h1 className="text-3xl font-extrabold tracking-tight mt-5">{group.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {groupType.label} · {group.members?.length} members · {group.currency}
            </p>
            {group.description && <p className="text-sm text-gray-600 mt-2">{group.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Report</p>
            <p className="text-xs text-gray-600">{formatDate(new Date())}</p>
            <p className="text-xs text-gray-500 mt-1">Prepared for {user?.name}</p>
          </div>
        </header>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-4 mb-8 page-break-inside-avoid">
          <Stat label="Total spent"   value={formatCurrency(totalSpent, group.currency)} />
          <Stat label="Expenses"      value={expenses.length} />
          <Stat label="Settlements"   value={settlements.length} />
          <Stat label="Members"       value={group.members?.length} />
        </div>

        {/* Members + balances */}
        <Section title="Member balances">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2">Member</th>
                <th className="py-2">Email</th>
                <th className="py-2 text-right">Net balance</th>
              </tr>
            </thead>
            <tbody>
              {group.members?.map((m) => {
                const bal = balances.find((b) => b.user?._id === m.user?._id);
                const amt = bal?.amount || 0;
                return (
                  <tr key={m.user?._id} className="border-b border-gray-100">
                    <td className="py-2.5 font-medium">{m.user?.name}</td>
                    <td className="py-2.5 text-gray-500">{m.user?.email}</td>
                    <td className={`py-2.5 text-right font-bold tabular-nums ${amt > 0.01 ? 'text-emerald-600' : amt < -0.01 ? 'text-rose-500' : 'text-gray-400'}`}>
                      {amt > 0.01 ? '+' : amt < -0.01 ? '−' : ''}{formatCurrency(Math.abs(amt), group.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* Who owes whom */}
        {transactions.length > 0 && (
          <Section title="Outstanding payments to settle">
            <ul className="divide-y divide-gray-100">
              {transactions.map((t, i) => (
                <li key={i} className="py-2.5 flex items-center text-sm">
                  <span className="font-medium">{t.from.name}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="font-medium">{t.to.name}</span>
                  <span className="ml-auto font-bold text-rose-600 tabular-nums">{formatCurrency(t.amount, t.currency)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Expenses table */}
        <Section title={`All expenses (${expenses.length})`}>
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2">Category</th>
                <th className="py-2">Paid by</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e._id} className="border-b border-gray-100 page-break-inside-avoid">
                  <td className="py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="py-2.5 font-medium">
                    {e.description}
                    {e.isRecurring && <span className="ml-1 text-[10px] text-blue-600">🔁 {e.recurringFrequency}</span>}
                  </td>
                  <td className="py-2.5 text-gray-600">
                    {CATEGORIES[e.category]?.icon} {CATEGORIES[e.category]?.label}
                  </td>
                  <td className="py-2.5 text-gray-600">{e.paidBy?.map((p) => p.user?.name).join(', ')}</td>
                  <td className="py-2.5 text-right font-bold tabular-nums">{formatCurrency(e.amount, e.currency)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan="4" className="py-3 text-right">Total</td>
                <td className="py-3 text-right tabular-nums">{formatCurrency(totalSpent, group.currency)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Settlements */}
        {settlements.length > 0 && (
          <Section title={`Recorded settlements (${settlements.length})`}>
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">From</th>
                  <th className="py-2">To</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s._id} className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{formatDate(s.date || s.createdAt)}</td>
                    <td className="py-2.5">{s.paidBy?.name}</td>
                    <td className="py-2.5">{s.paidTo?.name}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-emerald-600">{formatCurrency(s.amount, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
          Generated by SplitEase · {formatDate(new Date())} · Page printed for {user?.email}
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50/50">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-lg font-extrabold tracking-tight mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8 page-break-inside-avoid">
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
