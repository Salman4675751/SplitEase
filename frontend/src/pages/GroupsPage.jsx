import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiUsers, FiSearch } from 'react-icons/fi';
import api from '../services/api';
import { GROUP_TYPES, formatDate } from '../utils/formatters';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { CURRENCIES } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

function GroupCard({ group }) {
  const typeInfo = GROUP_TYPES[group.type] || GROUP_TYPES.other;
  return (
    <Link
      to={`/groups/${group._id}`}
      className="block bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-12 w-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-2xl">
          {typeInfo.icon}
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-muted">
          {typeInfo.label}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-dark-text group-hover:text-primary-600 transition-colors">{group.name}</h3>
      {group.description && (
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-0.5 truncate">{group.description}</p>
      )}
      <div className="flex items-center justify-between mt-4">
        <div className="flex -space-x-2">
          {group.members?.slice(0, 4).map((m) => (
            <div
              key={m.user._id}
              className="h-7 w-7 rounded-full bg-primary-500 border-2 border-white dark:border-dark-card flex items-center justify-center text-xs text-white font-semibold"
              title={m.user.name}
            >
              {m.user.name?.[0]?.toUpperCase()}
            </div>
          ))}
          {group.members?.length > 4 && (
            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-dark-border border-2 border-white dark:border-dark-card flex items-center justify-center text-xs text-gray-600 dark:text-dark-muted font-medium">
              +{group.members.length - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-dark-muted">{formatDate(group.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', type: 'other', currency: user?.currency || 'USD', memberEmails: '' });
  const [creating, setCreating] = useState(false);

  const fetchGroups = () =>
    api.get('/groups').then((r) => setGroups(r.data)).catch(() => toast.error('Failed to load groups')).finally(() => setLoading(false));

  useEffect(() => { fetchGroups(); }, []);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const createGroup = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const memberEmails = form.memberEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await api.post('/groups', { ...form, memberEmails });
      toast.success('Group created!');
      setShowCreate(false);
      setForm({ name: '', description: '', type: 'other', currency: user?.currency || 'USD', memberEmails: '' });
      fetchGroups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Groups</h1>
          <p className="text-sm text-gray-500 dark:text-dark-muted">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition text-sm"
        >
          <FiPlus className="h-4 w-4" /> New Group
        </button>
      </div>

      {/* Search */}
      {groups.length > 3 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FiUsers className="h-12 w-12 mx-auto text-gray-300 dark:text-dark-muted mb-4" />
          <h3 className="text-gray-700 dark:text-dark-text font-medium">No groups yet</h3>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-1">Create a group to start tracking shared expenses.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-5 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition"
          >
            Create your first group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => <GroupCard key={g._id} group={g} />)}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Group">
        <form onSubmit={createGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Group Name *</label>
            <input name="name" required value={form.name} onChange={handle} placeholder="e.g. Weekend Trip, Flat Share"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Description</label>
            <input name="description" value={form.description} onChange={handle} placeholder="Optional description"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Type</label>
              <select name="type" value={form.type} onChange={handle}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                {Object.entries(GROUP_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">Currency</label>
              <select name="currency" value={form.currency} onChange={handle}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                  <option key={code} value={code}>{symbol} {code}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-1.5">
              Invite Members <span className="text-gray-400 font-normal">(emails, comma-separated)</span>
            </label>
            <input name="memberEmails" value={form.memberEmails} onChange={handle} placeholder="alice@example.com, bob@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-border font-medium transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold transition text-sm">
              {creating ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
