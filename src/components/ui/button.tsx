import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'btn-beauty inline-flex items-center justify-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none cursor-pointer';

    const variants = {
      primary:
        'btn-primary-beauty bg-btn-primary text-white rounded-full border border-white/10',
      secondary:
        'btn-secondary-beauty bg-white text-neutral-800 border border-[#E4E4E0] rounded-full shadow-xs',
      outline:
        'bg-transparent hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 border border-neutral-300 hover:border-neutral-400 rounded-full',
      danger:
        'bg-red-600 hover:bg-red-700 hover:shadow-[0_8px_20px_rgba(220,38,38,0.3)] text-white rounded-full shadow-sm',
      ghost:
        'bg-transparent hover:bg-black/5 active:bg-black/10 text-neutral-700 rounded-lg transition-colors duration-150',
    };

    const sizes = {
      sm: 'min-h-[36px] px-3.5 py-1 text-xs gap-1.5',
      md: 'min-h-[44px] px-5 py-2 text-sm gap-2',
      lg: 'min-h-[50px] px-6 py-3 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

