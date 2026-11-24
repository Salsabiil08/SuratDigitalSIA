"use client";
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabledReason?: string;
  loadingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, disabledReason, loadingLabel = "Memproses…", children, ...props }, ref) => {
    const [ready,setReady]=React.useState(false);
    React.useEffect(()=>setReady(true),[]);
    const reason=disabledReason||(!ready?"Menyiapkan tindakan…":undefined);
    const reasonId=React.useId();
    const baseStyles =
      'btn-beauty max-w-full whitespace-normal break-words inline-flex items-center justify-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none cursor-pointer';

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
      <span className={cn("min-w-0 max-w-full inline-flex flex-col items-start gap-1 align-top",className?.includes("w-full") && "w-full")} >
      <button
        ref={ref}
        disabled={!ready || disabled || !!reason || isLoading}
        aria-describedby={reason ? reasonId : props["aria-describedby"]}
        title={!ready ? "Menyiapkan tindakan…" : reason || props.title}
        aria-busy={isLoading||undefined}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? loadingLabel : children}
      </button>
      {reason && <span id={reasonId} className="block text-xs text-neutral-600 max-w-sm">{reason}</span>}
      </span>
    );
  }
);

Button.displayName = 'Button';

