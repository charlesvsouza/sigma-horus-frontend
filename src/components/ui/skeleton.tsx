import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'card' | 'circle' | 'badge';
}

const variantStyles = {
  text: 'h-4 w-full rounded-md',
  card: 'h-32 w-full rounded-xl',
  circle: 'h-10 w-10 rounded-full',
  badge: 'h-5 w-16 rounded-full',
};

function Skeleton({ variant = 'text', className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-sigma-blue-mid/40 via-sigma-blue-mid/60 to-sigma-blue-mid/40 bg-[length:200%_100%] animate-[skeleton-pulse_1.5s_ease-in-out_infinite] ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/[6%] bg-sigma-blue-dark/80 p-5 space-y-4">
      <Skeleton variant="badge" />
      <Skeleton variant="text" className="w-3/4" />
      <Skeleton variant="text" className="w-1/2" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  );
}

export { Skeleton, SkeletonCard };
