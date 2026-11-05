import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`
            w-full px-4 py-2 rounded-lg
            bg-surface-raised border border-line
            text-text placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-card-blue/50 focus:border-card-blue
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${error ? 'border-danger focus:ring-danger/50 focus:border-danger' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
