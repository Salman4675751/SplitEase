import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiPlus, FiUsers, FiDollarSign, FiTrash2, FiArrowRight,
  FiChevronDown, FiChevronUp, FiUserPlus, FiDownload,
  FiMessageCircle, FiSend, FiCheckCircle, FiBarChart2, FiPrinter,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatRelativeDate, CATEGORIES, GROUP_TYPES } from '../utils/formatters';
import Avatar from '../components/common/Avatar';
import CategoryIcon from '../components/common/CategoryIcon';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AddExpenseModal from '../components/expenses/AddExpenseModal';
import ReactionBar from '../components/expenses/ReactionBar';
import SettleUpModal from '../components/settlements/SettleUpModal';
import MemberDetailModal from '../components/groups/MemberDetailModal';
import GroupCharts from '../components/groups/GroupCharts';

/**
 * Comments thread under an expanded expense.
 * Shows existing comments, lets users add a new one (notifies group via email).
 */
function CommentsSection({ expense, currentUser, onUpdate }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/expenses/${expense._id}/comments`, { text: text.trim() });
      setText('');
      toast.success('Comment posted');
      onUpdate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/expenses/${expense._id}/comments/${commentId}`);
      toast.success('Comment deleted');
      onUpdate();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const comments = expense.comments || [];

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
      <div className="flex items-center gap-1.5 mb-3">
        <FiMessageCircle className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wide">
          Comments {comments.length > 0 && `(${comments.length})`}
        </p>
      </div>

      {comments.length > 0 && (
        <ul className="space-y-2.5 mb-3">
          {comments.map((c) => (
            <li key={c._id} className="flex items-start gap-2.5 group/comment">
              <Avatar user={c.user} size="xs" />
              <div className="flex-1 min-w-0 bg-white dark:bg-dark-card rounded-xl px-3 py-2 border border-gray-100 dark:border-dark-border">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-900 dark:text-dark-text">{c.user?.name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-dark-muted">{formatRelativeDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-dark-text whitespace-pre-wrap break-words">{c.text}</p>
              </div>
              {c.user?._id === currentUser?._id && (
                <button
                  onClick={() => removeComment(c._id)}
                  className="opacity-0 group-hover/comment:opacity-100 p-1 rounded text-gray-400 hover:text-rose-500 transition"
                  title="Delete"
                >
                  <FiTrash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <Avatar user={currentUser} size="xs" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={posting || !text.trim()}
          className="p-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
        >
          <FiSend className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses');
  const [openMember, setOpenMember] = useState(null); // member object whose detail modal is open
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [expandedExpense, setExpandedExpense] = useState(null);

  const fetchAll = async () => {
    try {
      const [gRes, eRes, sRes, bRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/groups/${id}/expenses`),
        api.get(`/groups/${id}/settlements`),
        api.get(`/groups/${id}/balances`),
      ]);
      setGroup(gRes.data);
      setExpenses(eRes.data);
      setSettlements(sRes.data);
      setBalances(bRes.data.balances);
      setTransactions(bRes.data.transactions);
    } catch {
      toast.error('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const addMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      const { data } = await api.post(`/groups/${id}/members`, { email: memberEmail });
      if (data.status === 'invited') {
        toast.success(data.message || `Invitation sent to ${memberEmail}`);
      } else {
        toast.success('Member added!');
      }
      setMemberEmail('');
      setShowAddMember(false);
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId) => {
    if (!confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      toast.success('Member removed');
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteExpense = async (expId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expId}`);
      toast.success('Expense deleted');
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Paid By', 'Split Type'],
      ...expenses.map((e) => [
        formatDate(e.date),
        e.description,
        e.category,
        e.amount,
        e.currency,
        e.paidBy?.map((p) => p.user?.name).join(' + '),
        e.splitType,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group?.name}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isAdmin = group?.members?.find(
    (m) => m.user?._id === user?._id && m.role === 'admin'
  );

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;
  if (!group) return null;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const groupType = GROUP_TYPES[group.type] || GROUP_TYPES.other;
  const myBalance = balances.find((b) => b.user?._id === user?._id)?.amount || 0;

  return (
    <div className="space-y-6 animate-fadein pb-24 lg:pb-6">
      {/* Hero header — gradient background based on group type */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${groupType.gradient} p-6 sm:p-7 text-white shadow-glow-lg`}>
        {/* Decorative concentric rings */}
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-white/10" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
              {groupType.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">{groupType.label}</span>
                <span className="text-white/40">•</span>
                <span className="text-[11px] font-medium text-white/80">{group.members?.length} members</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">{group.name}</h1>
              {group.description && (
                <p className="text-white/80 text-sm mt-1.5">{group.description}</p>
              )}

              {/* Member avatar stack */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex -space-x-2">
                  {group.members?.slice(0, 6).map((m) => (
                    <div key={m.user?._id} className="ring-2 ring-white/30 rounded-full">
                      <Avatar user={m.user} size="sm" />
                    </div>
                  ))}
                  {group.members?.length > 6 && (
                    <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur ring-2 ring-white/30 flex items-center justify-center text-xs text-white font-semibold">
                      +{group.members.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="hidden sm:flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-primary-700 hover:bg-white/90 text-sm font-semibold transition shadow-md"
            >
              <FiPlus className="h-4 w-4" /> Add Expense
            </button>
            <button
              onClick={() => setShowSettleUp(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/30 hover:bg-white/25 text-white text-sm font-semibold transition"
            >
              <FiCheckCircle className="h-4 w-4" /> Settle Up
            </button>
            <div className="flex gap-1">
              <button
                onClick={exportCSV}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white/80 hover:text-white text-xs font-medium transition"
              >
                <FiDownload className="h-3.5 w-3.5" /> CSV
              </button>
              <Link
                to={`/groups/${id}/report`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white/80 hover:text-white text-xs font-medium transition"
              >
                <FiPrinter className="h-3.5 w-3.5" /> Report
              </Link>
            </div>
          </div>
        </div>

        {/* Hero stat strip */}
        <div className="relative grid grid-cols-3 gap-px bg-white/10 mt-6 rounded-2xl overflow-hidden">
          <div className="bg-white/[0.08] backdrop-blur px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Total Spent</p>
            <p className="text-xl font-extrabold tracking-tight mt-0.5">{formatCurrency(totalExpenses, group.currency)}</p>
          </div>
          <div className="bg-white/[0.08] backdrop-blur px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Expenses</p>
            <p className="text-xl font-extrabold tracking-tight mt-0.5">{expenses.length}</p>
          </div>
          <div className="bg-white/[0.08] backdrop-blur px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Your Balance</p>
            <p className={`text-xl font-extrabold tracking-tight mt-0.5 ${myBalance > 0.01 ? 'text-emerald-200' : myBalance < -0.01 ? 'text-rose-200' : 'text-white'}`}>
              {myBalance > 0.01 ? '+' : ''}{formatCurrency(myBalance, group.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-dark-border rounded-xl p-1 gap-1 overflow-x-auto">
            {[
              { id: 'expenses',    label: `Expenses (${expenses.length})` },
              { id: 'settlements', label: `Settlements (${settlements.length})` },
              { id: 'charts',      label: 'Charts', icon: FiBarChart2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text shadow-sm'
                    : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
              </button>
            ))}
          </div>

          {/* Charts tab */}
          {activeTab === 'charts' && (
            <GroupCharts expenses={expenses} group={group} members={group.members} />
          )}

          {/* Expenses tab */}
          {activeTab === 'expenses' && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm">
              {expenses.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
                    <FiDollarSign className="h-7 w-7 text-primary-500" />
                  </div>
                  <h3 className="text-gray-700 dark:text-dark-text font-semibold">No expenses yet</h3>
                  <p className="text-gray-500 dark:text-dark-muted text-sm mt-1">Track your first shared cost in this group.</p>
                  <button onClick={() => setShowAddExpense(true)} className="mt-4 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">
                    + Add Expense
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-dark-border/50">
                  {expenses.map((exp) => {
                    const isExpanded = expandedExpense === exp._id;
                    const myPaid = exp.paidBy?.find((p) => p.user?._id === user?._id);
                    const mySplit = exp.splits?.find((s) => s.user?._id === user?._id);
                    const canDelete = exp.createdBy?._id === user?._id || isAdmin;
                    const myShare = mySplit?.amount || 0;
                    const myPaidAmt = myPaid?.amount || 0;
                    const myNet = myPaidAmt - myShare; // positive = lent, negative = owe

                    return (
                      <li key={exp._id} className={isExpanded ? 'bg-gray-50/60 dark:bg-dark-border/20' : ''}>
                        <div
                          className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-dark-border/30 transition-colors"
                          onClick={() => setExpandedExpense(isExpanded ? null : exp._id)}
                        >
                          <CategoryIcon category={exp.category} size="sm" />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{exp.description}</p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                              <span>{formatRelativeDate(exp.date)}</span>
                              <span className="text-gray-300 dark:text-dark-border">•</span>
                              <span className="truncate">{exp.paidBy?.map((p) => p.user?._id === user?._id ? 'You' : p.user?.name?.split(' ')[0]).join(', ')} paid</span>
                              <span className="text-gray-300 dark:text-dark-border hidden sm:inline">•</span>
                              <span className="hidden sm:inline capitalize text-gray-400">{exp.splitType} split</span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-dark-text tabular-nums">{formatCurrency(exp.amount, exp.currency)}</p>
                            {/*
                              Per-expense status — colored by whether the user is a creditor
                              (green) or debtor (red) for THIS expense. Net debt across all
                              expenses + settlements lives in the hero "Your Balance" stat.
                            */}
                            {myPaidAmt > 0 && myNet > 0.01 ? (
                              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                you lent {formatCurrency(myNet, exp.currency)}
                              </span>
                            ) : myPaidAmt > 0 && Math.abs(myNet) <= 0.01 ? (
                              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                you paid
                              </span>
                            ) : myShare > 0.01 ? (
                              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                                your share {formatCurrency(myShare, exp.currency)}
                              </span>
                            ) : (
                              <span className="inline-block text-[11px] font-medium text-gray-400 mt-0.5">not involved</span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                            {canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteExpense(exp._id); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                title="Delete"
                              >
                                <FiTrash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <div className={`p-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                              <FiChevronDown className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-4 bg-gray-50 dark:bg-dark-border/30 border-t border-gray-100 dark:border-dark-border">
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wide">Split Details</p>
                              {exp.splits?.map((s) => (
                                <div key={s.user?._id} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Avatar user={s.user} size="xs" />
                                    <span className="text-sm text-gray-700 dark:text-dark-text">{s.user?.name}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                                    {formatCurrency(s.amount, exp.currency)}
                                    {s.percentage ? ` (${s.percentage}%)` : ''}
                                  </span>
                                </div>
                              ))}
                              {exp.notes && (
                                <p className="text-xs text-gray-500 dark:text-dark-muted mt-2 italic">📝 {exp.notes}</p>
                              )}
                            </div>

                            <ReactionBar
                              expense={exp}
                              currentUserId={user?._id}
                              onUpdate={fetchAll}
                            />

                            <CommentsSection
                              expense={exp}
                              currentUser={user}
                              onUpdate={fetchAll}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Settlements tab */}
          {activeTab === 'settlements' && (
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
              {settlements.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-dark-muted">
                  <p className="text-sm">No settlements yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-dark-border">
                  {settlements.map((s) => (
                    <li key={s._id} className="flex items-center gap-4 px-5 py-4">
                      <Avatar user={s.paidBy} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-dark-text">
                          <span className="font-medium">{s.paidBy?.name}</span>
                          <FiArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-medium">{s.paidTo?.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-dark-muted">{formatRelativeDate(s.settledAt)}</p>
                      </div>
                      <span className="font-semibold text-emerald-600 text-sm">{formatCurrency(s.amount, s.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: Balances & Members */}
        <div className="space-y-4">
          {/* Simplified balances */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-dark-border bg-gradient-to-br from-gray-50 to-white dark:from-dark-border/30 dark:to-dark-card">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-dark-text">Who Owes Whom</h3>
                {transactions.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                    {transactions.length} txn{transactions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">Smart algorithm minimizes payments</p>
            </div>
            {transactions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-semibold text-gray-700 dark:text-dark-text">All settled up!</p>
                <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">Everyone is even.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-dark-border/50">
                {transactions.map((t, i) => {
                  const isMineToPay = t.from._id === user?._id;
                  return (
                    <li key={i} className="px-5 py-3.5 group/txn hover:bg-gray-50/80 dark:hover:bg-dark-border/20 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={t.from} size="xs" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-gray-900 dark:text-dark-text truncate">
                              {isMineToPay ? 'You' : t.from.name?.split(' ')[0]}
                            </span>
                            <FiArrowRight className="h-3 w-3 text-gray-300 dark:text-dark-muted flex-shrink-0" />
                            <span className="font-semibold text-gray-900 dark:text-dark-text truncate">{t.to.name?.split(' ')[0]}</span>
                          </div>
                          <span className="text-[15px] font-bold text-rose-500 tabular-nums">{formatCurrency(t.amount, t.currency)}</span>
                        </div>
                        {isMineToPay && (
                          <button
                            onClick={() => setShowSettleUp(true)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition opacity-0 group-hover/txn:opacity-100 flex-shrink-0"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Members with visual balance bars */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-border">
              <h3 className="font-bold text-gray-900 dark:text-dark-text">Members</h3>
              <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-xs font-semibold transition">
                <FiUserPlus className="h-3.5 w-3.5" /> Invite
              </button>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-dark-border/50">
              {(() => {
                const maxAbs = Math.max(0.01, ...balances.map((b) => Math.abs(b.amount)));
                return group.members?.map((m) => {
                  const balance = balances.find((b) => b.user?._id === m.user?._id);
                  const netAmt = balance?.amount || 0;
                  const pct = Math.min(100, (Math.abs(netAmt) / maxAbs) * 100);
                  const positive = netAmt > 0.01;
                  const negative = netAmt < -0.01;
                  return (
                    <li key={m.user?._id} className="px-5 py-3 group/mem cursor-pointer hover:bg-gray-50/80 dark:hover:bg-dark-border/20 transition-colors" onClick={() => setOpenMember(m.user)}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <Avatar user={m.user} size="sm" />
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate hover:underline">{m.user?.name}</p>
                          {m.user?._id === user?._id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                              you
                            </span>
                          )}
                          {m.role === 'admin' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                              admin
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-rose-500 dark:text-rose-400' : 'text-gray-400'}`}>
                          {positive ? '+' : negative ? '−' : ''}{formatCurrency(Math.abs(netAmt), group.currency)}
                        </span>
                        {isAdmin && m.user?._id !== user?._id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeMember(m.user?._id); }}
                            className="opacity-0 group-hover/mem:opacity-100 p-1 rounded text-gray-400 hover:text-rose-500 transition"
                          >
                            <FiTrash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Visual balance bar */}
                      <div className="ml-11 h-1.5 rounded-full bg-gray-100 dark:bg-dark-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${positive
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : negative
                              ? 'bg-gradient-to-r from-rose-400 to-rose-500'
                              : 'bg-gray-200'}`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <p className="ml-11 text-[10px] text-gray-400 dark:text-dark-muted mt-1">
                        {positive ? 'gets back' : negative ? 'owes overall' : 'all square'}
                      </p>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile floating action buttons */}
      <div className="sm:hidden fixed bottom-4 right-4 left-4 z-30 flex gap-2">
        <button
          onClick={() => setShowSettleUp(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text font-semibold shadow-lg text-sm"
        >
          <FiCheckCircle className="h-4 w-4" /> Settle
        </button>
        <button
          onClick={() => setShowAddExpense(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-primary-600 text-white font-semibold shadow-glow-lg text-sm"
        >
          <FiPlus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        group={group}
        onSuccess={fetchAll}
      />

      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => setShowSettleUp(false)}
        group={group}
        transactions={transactions}
        onSuccess={fetchAll}
      />

      <MemberDetailModal
        isOpen={!!openMember}
        onClose={() => setOpenMember(null)}
        member={openMember}
        balances={balances}
        transactions={transactions}
        currency={group.currency}
        currentUserId={user?._id}
        isAdmin={isAdmin}
        onRemove={removeMember}
      />

      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Invite Member" size="sm">
        <form onSubmit={addMember} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Member Email</label>
            <input
              type="email" required value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-dark-muted mt-2 flex items-start gap-1.5">
              <span className="text-primary-500 mt-0.5">ⓘ</span>
              <span>If they have a SplitEase account, they're added instantly. Otherwise, an email invite is sent and they'll auto-join after signup.</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowAddMember(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-border font-medium transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={addingMember}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
              {addingMember ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
