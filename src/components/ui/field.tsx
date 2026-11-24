import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, error, hint, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0 max-w-full flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-neutral-800 flex items-center gap-1">
          {label}
          {required && <span className="text-brand-red">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="text-[11px] text-neutral-500">{hint}</span>}
      {error && <span className="text-[11px] font-medium text-red-600">{error}</span>}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full min-w-0 max-w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-[#C9C9C3] rounded-lg transition-colors placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red disabled:bg-neutral-100 disabled:cursor-not-allowed',
          hasError && 'border-red-500 focus:ring-red-200 focus:border-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full min-w-0 max-w-full p-3 text-sm bg-white border border-[#C9C9C3] rounded-lg transition-colors placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red disabled:bg-neutral-100 disabled:cursor-not-allowed min-h-[90px]',
          hasError && 'border-red-500 focus:ring-red-200 focus:border-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full min-w-0 max-w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-[#C9C9C3] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red disabled:bg-neutral-100 disabled:cursor-not-allowed',
          hasError && 'border-red-500 focus:ring-red-200 focus:border-red-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

