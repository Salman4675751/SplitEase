import { CATEGORIES, CATEGORY_STYLES } from '../../utils/formatters';

/**
 * Color-coded category badge — replaces plain emoji rendering with a
 * proper visual treatment that ties into the category palette.
 */
export default function CategoryIcon({ category = 'other', size = 'md', className = '' }) {
  const sizes = {
    xs: 'h-8 w-8 text-base rounded-xl',
    sm: 'h-10 w-10 text-lg rounded-xl',
    md: 'h-12 w-12 text-xl rounded-2xl',
    lg: 'h-14 w-14 text-2xl rounded-2xl',
  };

  const cat = CATEGORIES[category] || CATEGORIES.other;
  const colors = CATEGORY_STYLES[cat.color] || CATEGORY_STYLES.slate;

  return (
    <div className={`${sizes[size]} ${colors} flex items-center justify-center flex-shrink-0 ${className}`}>
      <span aria-hidden>{cat.icon}</span>
    </div>
  );
}
