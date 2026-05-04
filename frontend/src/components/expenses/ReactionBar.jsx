import { useState, useRef, useEffect } from 'react';
import { FiSmile } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Slack-style emoji reactions on an expense.
 * Click a reaction chip → toggle yours on/off.
 * Click + → opens a quick-pick of common emojis.
 */
const QUICK_EMOJI = ['👍', '❤️', '🔥', '🎉', '😂', '😱', '💸', '🍕', '👀', '🙏'];

export default function ReactionBar({ expense, currentUserId, onUpdate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const reactions = expense.reactions || [];

  // Group by emoji → { emoji, users: [...], count, mine: bool }
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, users: [], count: 0, mine: false };
    acc[r.emoji].users.push(r.user);
    acc[r.emoji].count++;
    if (r.user?._id === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});
  const groups = Object.values(grouped).sort((a, b) => b.count - a.count);

  const toggle = async (emoji) => {
    setPickerOpen(false);
    try {
      const { data } = await api.post(`/expenses/${expense._id}/reactions`, { emoji });
      onUpdate?.(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-3">
      {groups.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => toggle(g.emoji)}
          title={g.users.map((u) => u?.name).filter(Boolean).join(', ')}
          className={`group/r flex items-center gap-1 px-2 py-1 rounded-full border transition text-xs font-semibold ${
            g.mine
              ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-500/15 dark:border-primary-500/40 dark:text-primary-300'
              : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:border-gray-300 dark:hover:border-dark-muted'
          }`}
        >
          <span className="text-sm leading-none">{g.emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPickerOpen((s) => !s)}
          className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-gray-300 dark:border-dark-border text-gray-400 dark:text-dark-muted hover:text-primary-600 hover:border-primary-300 dark:hover:text-primary-400 dark:hover:border-primary-500/40 transition text-xs font-semibold"
        >
          <FiSmile className="h-3.5 w-3.5" />
          {groups.length === 0 && <span>React</span>}
        </button>

        {pickerOpen && (
          <div className="absolute z-20 bottom-full left-0 mb-2 px-2 py-2 rounded-2xl bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-lg flex gap-1 animate-fadein">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border transition text-lg leading-none"
                title={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
