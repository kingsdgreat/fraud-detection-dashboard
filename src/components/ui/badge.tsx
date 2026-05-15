import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'outline';
}

const variantClasses: Record<string, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
  outline: 'bg-transparent text-gray-700 border-gray-300',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export function RiskBadge({ band }: { band: string }) {
  const variant = band.toLowerCase() as BadgeProps['variant'];
  return <Badge variant={variant}>{band}</Badge>;
}
