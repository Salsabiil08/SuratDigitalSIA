import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChipVariant = 'gray' | 'amber' | 'blue' | 'green' | 'red';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
}

export function Chip({ className, variant = 'gray', children, ...props }: ChipProps) {
  const variantStyles: Record<ChipVariant, string> = {
    gray: 'bg-[#ECECE8] text-[#3D3D3A]',
    amber: 'bg-[#FFF0D1] text-[#7A4B00]',
    blue: 'bg-[#E3EEFF] text-[#1B4FA0]',
    green: 'bg-[#DDF3E4] text-[#1D6B3A]',
    red: 'bg-[#FBE0E4] text-[#9A1028]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold max-w-full whitespace-normal sm:whitespace-nowrap leading-tight',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Helper untuk memetakan status surat ke varian warna Chip sesuai blueprint */
export function getStatusChipVariant(status: string): ChipVariant {
  switch (status) {
    case 'DRAFT':
      return 'gray';
    case 'IN_REVIEW':
    case 'WAITING':
      return 'amber';
    case 'READY_TO_ISSUE':
      return 'blue';
    case 'NUMBERED':
    case 'UPLOADED':
      return 'green';
    case 'REJECTED':
    case 'CANCELLED':
    case 'REVISION_REQUESTED':
      return 'red';
    default:
      return 'gray';
  }
}

