/**
 * SplitEase Logo — "Offset Equals"
 *
 * Concept: two horizontal pills shifted in opposite directions. Reads as the
 * "=" sign (equal/fair split) but with motion — money flowing between two
 * parties. Bold, geometric, and distinctive at any scale.
 *
 * Variants:
 *   - "gradient" (default): teal→darker-teal gradient on transparent
 *   - "inverse":  pure white — for use on the teal hero panel
 *   - "mono":     uses `currentColor` — adapts to text color via Tailwind
 */

import { useId } from 'react';

export default function Logo({
  size = 32,
  withText = false,
  variant = 'gradient',
  animated = false,
  className = '',
  textClassName = '',
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `logo-grad-${uid}`;

  const palette = {
    gradient: { fill: `url(#${gradId})`, accentOpacity: 0.55 },
    inverse:  { fill: '#ffffff',         accentOpacity: 0.6 },
    mono:     { fill: 'currentColor',    accentOpacity: 0.5 },
  }[variant];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        role="img"
        aria-label="SplitEase logo"
        xmlns="http://www.w3.org/2000/svg"
        className={`flex-shrink-0 ${animated ? 'group/logo' : ''}`}
      >
        {variant === 'gradient' && (
          <defs>
            {/* SVG gradients accept CSS color() values, so the active theme's
                primary scale flows through automatically. */}
            <linearGradient id={gradId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="rgb(var(--p-400))" />
              <stop offset="100%" stopColor="rgb(var(--p-700))" />
            </linearGradient>
          </defs>
        )}

        {/* Top pill — leans left, full opacity */}
        <rect
          x="3"
          y="12"
          width="26"
          height="6"
          rx="3"
          fill={palette.fill}
          className={animated ? 'origin-center transition-transform duration-500 group-hover/logo:translate-x-[-1.5px] motion-safe:animate-logo-bar-top' : ''}
        />

        {/* Bottom pill — leans right, slightly transparent */}
        <rect
          x="11"
          y="22"
          width="26"
          height="6"
          rx="3"
          fill={palette.fill}
          fillOpacity={palette.accentOpacity}
          className={animated ? 'origin-center transition-transform duration-500 group-hover/logo:translate-x-[1.5px] motion-safe:animate-logo-bar-bottom' : ''}
        />
      </svg>

      {withText && (
        <span
          className={`font-extrabold tracking-tight leading-none ${textClassName}`}
          style={{ fontSize: size * 0.6 }}
        >
          <span className="text-gray-900 dark:text-white">Split</span>
          <span className="text-primary-600 dark:text-primary-400">Ease</span>
        </span>
      )}
    </div>
  );
}
