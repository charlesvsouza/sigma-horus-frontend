import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
}

const variantStyles = {
  default:
    'border border-white/[6%] bg-sigma-card rounded-xl',
  elevated:
    'border border-white/[10%] bg-sigma-card-elevated rounded-xl',
  interactive:
    'border border-white/[6%] bg-sigma-card rounded-xl hover:border-gold/25 hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer',
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
