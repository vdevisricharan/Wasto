import React from 'react';
import { AlertTriangle, Archive, Leaf, Recycle } from 'lucide-react';
import { RoutingCategory } from '../../types';
import { ROUTING_CATEGORY_META } from '../../theme/tokens';

interface CategoryBadgeProps {
  category: RoutingCategory | string;
  size?: 'sm' | 'md';
  showChute?: boolean;
  className?: string;
}

export const getCategoryIcon = (category: RoutingCategory | string, size = 14) => {
  switch (category) {
    case 'Organic':
      return <Leaf size={size} strokeWidth={1.9} aria-hidden="true" />;
    case 'Recyclable':
      return <Recycle size={size} strokeWidth={1.9} aria-hidden="true" />;
    case 'Residual':
      return <Archive size={size} strokeWidth={1.9} aria-hidden="true" />;
    default:
      return <AlertTriangle size={size} strokeWidth={1.9} aria-hidden="true" />;
  }
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  size = 'md',
  showChute = false,
  className = '',
}) => {
  const meta =
    ROUTING_CATEGORY_META[category as RoutingCategory] ??
    ROUTING_CATEGORY_META['Unknown / Manual Review'];

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[12px] gap-1'
      : 'px-2.5 py-1 text-[13px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-[8px] whitespace-nowrap ${meta.badgeClasses} ${sizeClasses} ${className}`}
    >
      {getCategoryIcon(meta.key, size === 'sm' ? 13 : 14)}
      <span>{meta.label}</span>
      {showChute && (
        <span className="opacity-80 font-normal">· {meta.chuteLabel}</span>
      )}
    </span>
  );
};
