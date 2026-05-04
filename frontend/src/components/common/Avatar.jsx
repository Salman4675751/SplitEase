import { getInitials, avatarColor } from '../../utils/formatters';

export default function Avatar({ user, size = 'md', className = '' }) {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} ${avatarColor(user?.name)} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
    >
      {getInitials(user?.name || '?')}
    </div>
  );
}
