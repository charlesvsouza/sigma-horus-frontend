import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-gold text-sigma-blue-deep font-medium hover:bg-gold-light active:bg-gold-dark disabled:opacity-40',
  secondary:
    'border border-white/10 bg-sigma-blue-mid/30 text-sand-light hover:bg-sigma-blue-mid/50 active:bg-sigma-blue-mid/60 disabled:opacity-40',
  ghost:
    'text-sand hover:bg-white/5 active:bg-white/10 disabled:opacity-40',
  danger:
    'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 active:bg-rose-500/35 disabled:opacity-40',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-all duration-200 ease-out ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { Button, type ButtonProps, type Variant, type Size };
