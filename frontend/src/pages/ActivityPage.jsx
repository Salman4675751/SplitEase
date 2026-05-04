import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlusCircle, FiCheckCircle, FiMessageCircle, FiUsers,
  FiArrowRight,
} from 'react-icons/fi';
import api from '../services/api';
import { formatCurrency, formatRelativeDate } from '../utils/formatters';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TYPE_META = {
  expense_added:  { icon: FiPlusCircle,    color: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400' },
  comment:        { icon: FiMessageCircle, color: 'text-purple-600 bg-purple-100 dark:bg-purple-500/15 dark:text-purple-400' },
  settled:        { icon: FiCheckCircle,   color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  group_created:  { icon: FiUsers,         color: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
};

/**
 * Chronological view of every event across the user's groups.
 * Grouped by day for readability.
 */
export default function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activity?limit=100')
      .then((r) => setEvents(r.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  // Group by day for the timeline header
  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const d = new Date(ev.timestamp);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return Array.from(map.entries());
  }, [events]);

  const dayLabel = (key) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (key === today) return 'Today';
    if (key === yesterday) return 'Yesterday';
    return new Date(key).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-3xl space-y-6 animate-fadein">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-dark-text">Activity</h1>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-0.5">Every event across your groups, in one feed</p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border py-16 text-center">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="font-semibold text-gray-700 dark:text-dark-text">Nothing here yet</h3>
          <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">Activity from your groups will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <section key={day}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-dark-muted">{dayLabel(day)}</h2>
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border" />
                <span className="text-xs text-gray-400 dark:text-dark-muted">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>
              </div>

              <ul className="space-y-2">
                {dayEvents.map((ev, i) => {
                  const meta = TYPE_META[ev.type] || TYPE_META.expense_added;
                  const Icon = meta.icon;
                  return (
                    <li key={i} className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-3.5 hover:shadow-sm transition">
                      <div className="flex items-start gap-3">
                        {/* Actor avatar with type icon overlay */}
                        <div className="relative flex-shrink-0">
                          <Avatar user={ev.actor} size="sm" />
                          <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full ${meta.color} flex items-center justify-center ring-2 ring-white dark:ring-dark-card`}>
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-dark-text">
                            {ev.title}
                            {ev.amount != null && (
                              <span className="font-bold ml-1 tabular-nums">{formatCurrency(ev.amount, ev.currency)}</span>
                            )}
                            {ev.recipient && (
                              <span className="inline-flex items-center gap-1 ml-1 text-gray-500 dark:text-dark-muted">
                                <FiArrowRight className="h-3 w-3" />
                                <span className="font-medium text-gray-700 dark:text-dark-text">{ev.recipient.name}</span>
                              </span>
                            )}
                          </p>

                          {ev.comment && (
                            <p className="text-xs text-gray-600 dark:text-dark-muted mt-1 italic px-3 py-1.5 bg-gray-50 dark:bg-dark-border/30 rounded-lg border-l-2 border-purple-300 dark:border-purple-500/30">
                              "{ev.comment}"
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-dark-muted">
                            <span>{formatRelativeDate(ev.timestamp)}</span>
                            {ev.group && (
                              <>
                                <span>·</span>
                                <Link to={`/groups/${ev.group._id}`} className="font-medium hover:text-primary-600 dark:hover:text-primary-400">
                                  {ev.group.name}
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
