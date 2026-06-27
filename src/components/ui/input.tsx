import { InputHTMLAttributes, forwardRef } from 'react';
import { inputBase, inputBorder, inputBorderError } from './field-styles';

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
          className={`${inputBase} ${error ? inputBorderError : inputBorder} ${className}`}
          {...props}
        />
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
