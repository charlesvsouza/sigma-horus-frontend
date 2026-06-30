import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
}

const variantStyles = {
  default:
    'border border-white/[5%] bg-sigma-card rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]',
  elevated:
    'border border-white/[8%] bg-sigma-card-elevated rounded-xl shadow-[0_12px_32px_-14px_rgba(0,0,0,0.55)]',
  interactive:
    'border border-white/[5%] bg-sigma-card rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] hover:border-gold/25 hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`p-5 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

const CardTitle = ({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold text-sand-light ${className}`} {...props}>
    {children}
  </h3>
);

const CardDescription = ({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-sand-dark ${className}`} {...props}>
    {children}
  </p>
);

export { Card, CardTitle, CardDescription };
