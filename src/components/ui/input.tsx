import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-sand">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-sigma-blue-deep/60 px-4 py-2.5 text-sm text-sand-light placeholder:text-sand-dark outline-none transition-all duration-200 ease-out
            ${error
              ? 'border-rose-500/50 ring-2 ring-rose-500/20'
              : 'border-white/[8%] focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
