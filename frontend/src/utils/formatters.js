export const CURRENCIES = {
  USD: { symbol: '$',   name: 'US Dollar' },
  EUR: { symbol: '€',   name: 'Euro' },
  GBP: { symbol: '£',   name: 'British Pound' },
  AED: { symbol: 'AED', name: 'UAE Dirham' },
  INR: { symbol: '₹',   name: 'Indian Rupee' },
  JPY: { symbol: '¥',   name: 'Japanese Yen' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$',  name: 'Australian Dollar' },
};

export const CATEGORIES = {
  food:          { label: 'Food & Drink',  icon: '🍽️', color: 'orange' },
  transport:     { label: 'Transport',     icon: '🚗', color: 'blue' },
  accommodation: { label: 'Accommodation', icon: '🏠', color: 'purple' },
  entertainment: { label: 'Entertainment', icon: '🎬', color: 'pink' },
  utilities:     { label: 'Utilities',     icon: '💡', color: 'yellow' },
  shopping:      { label: 'Shopping',      icon: '🛍️', color: 'rose' },
  health:        { label: 'Health',        icon: '💊', color: 'emerald' },
  other:         { label: 'Other',         icon: '📦', color: 'slate' },
};

// Maps category color names to Tailwind utility groups (light + dark mode)
export const CATEGORY_STYLES = {
  orange:  'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  blue:    'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  purple:  'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
  pink:    'bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400',
  yellow:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  rose:    'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  slate:   'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
};

export const GROUP_TYPES = {
  trip:   { label: 'Trip',   icon: '✈️', gradient: 'from-sky-500 via-cyan-500 to-blue-600' },
  home:   { label: 'Home',   icon: '🏠', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
  office: { label: 'Office', icon: '💼', gradient: 'from-slate-600 via-gray-700 to-zinc-800' },
  other:  { label: 'Other',  icon: '👥', gradient: 'from-primary-500 via-primary-600 to-primary-700' },
};

/**
 * Format a number as a localized currency string.
 * Uses Intl.NumberFormat for proper symbol/code placement (e.g. "AED 50.00", "$50.00", "₹50.00").
 */
export function formatCurrency(amount, currency = 'USD') {
  const value = amount ?? 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const sym = CURRENCIES[currency]?.symbol || currency;
    return `${sym} ${value.toFixed(2)}`;
  }
}

/** Currency prefix for input fields — short readable form (`$`, `AED`, `€`). */
export function currencyPrefix(currency = 'USD') {
  return CURRENCIES[currency]?.symbol || currency;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatRelativeDate(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr < 24)   return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return `${diffDays} days ago`;
  return formatDate(date);
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function avatarColor(name = '') {
  const colors = [
    'bg-rose-500', 'bg-pink-500', 'bg-purple-500', 'bg-indigo-500',
    'bg-blue-500', 'bg-cyan-500', 'bg-teal-500', 'bg-green-500',
    'bg-yellow-500', 'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
