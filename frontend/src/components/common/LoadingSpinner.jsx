/**
 * Branded loading spinner — a rotating arc in the SplitEase teal gradient.
 */
export default function LoadingSpinner({ fullscreen = false, size = 'md' }) {
  const sizes = { sm: 20, md: 36, lg: 56 };
  const px = sizes[size];

  const spinner = (
    <div className="relative" style={{ width: px, height: px }}>
      <svg className="animate-spin" width={px} height={px} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spin-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="rgb(var(--p-400))" />
            <stop offset="100%" stopColor="rgb(var(--p-700))" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" className="text-primary-100 dark:text-dark-border" />
        <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="url(#spin-grad)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-dark-bg z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}
