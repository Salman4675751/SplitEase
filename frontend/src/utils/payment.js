/**
 * Payment method metadata + helpers.
 * SplitEase doesn't process money — it stores the recipient's payment receive
 * details so the payer can transfer via their own bank app (free, instant in UAE).
 */

export const PAYMENT_TYPES = {
  iban: {
    label: 'Bank IBAN',
    icon: '🏦',
    short: 'IBAN',
    placeholder: 'AE07 0331 1234 5678 9012 345',
    hint: 'Free instant transfer between UAE banks',
    color: 'blue',
  },
  aani: {
    label: 'Aani',
    icon: '⚡',
    short: 'Aani',
    placeholder: '+971 50 123 4567',
    hint: 'UAE Central Bank instant payments — use mobile in your bank app',
    color: 'emerald',
  },
  paypal: {
    label: 'PayPal',
    icon: '💳',
    short: 'PayPal',
    placeholder: 'you@example.com or paypal.me/yourname',
    hint: 'For international transfers',
    color: 'indigo',
  },
  dupay: {
    label: 'DU Pay',
    icon: '📲',
    short: 'DU Pay',
    placeholder: '+971 55 123 4567',
    hint: 'DU mobile wallet',
    color: 'rose',
  },
};

export const PAYMENT_TYPE_STYLES = {
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  indigo:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  rose:    'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

/** Format an IBAN by inserting spaces every 4 chars for readability. */
export function formatIBAN(raw) {
  return (raw || '').replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

/** Strip non-digits from a phone string and return digits-only (no +). */
export function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

/**
 * Build a wa.me deep-link to message a phone number.
 * Falls back to a plain wa.me URL when the recipient's phone isn't known.
 */
export function whatsappURL({ phone, message }) {
  const d = digitsOnly(phone);
  const encoded = encodeURIComponent(message || '');
  return d ? `https://wa.me/${d}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/** Display-format a payment value depending on its type. */
export function displayValue(method) {
  if (!method) return '';
  if (method.type === 'iban') return formatIBAN(method.value);
  return method.value;
}

/** Pull the first phone-like value out of a list of methods (for WhatsApp). */
export function findPhoneMethod(methods) {
  if (!Array.isArray(methods)) return undefined;
  return methods.find((m) => m.type === 'aani' || m.type === 'dupay');
}
