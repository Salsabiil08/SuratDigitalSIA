'use client';

import * as React from 'react';

interface LiveClockProps {
  variant?: 'default' | 'topbar';
  className?: string;
}

export function LiveClock({ variant = 'default', className = '' }: LiveClockProps) {
  const [timeStr, setTimeStr] = React.useState<string>('');
  const [dateStr, setDateStr] = React.useState<string>('');
  const [shortDateStr, setShortDateStr] = React.useState<string>('');

  React.useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      
      // Format Tanggal Indonesia: Sabtu, 14 November 2026
      const formattedDate = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // Format Pendek: SEL, 17 NOV 2026
      const formattedShortDate = now.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).toUpperCase();

      // Format Waktu: 04.15 WIB
      const formattedTime =
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }).replace(':', '.') + ' WIB';

      setDateStr(formattedDate);
      setShortDateStr(formattedShortDate);
      setTimeStr(formattedTime);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dateStr) {
    return null;
  }

  if (variant === 'topbar') {
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1 bg-black/25 text-white rounded-full text-xs font-mono border border-white/15 shadow-xs shrink-0 select-none ${className}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="font-bold tracking-tight text-white">{timeStr}</span>
        <span className="text-white/40">&bull;</span>
        <span className="text-white/80 text-[11px] font-sans font-medium">{shortDateStr}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-1.5 bg-white/80 backdrop-blur-xs border border-[#E4E4E0] rounded-xl text-xs shadow-2xs ${className}`}>
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="font-semibold text-neutral-800">{dateStr}</span>
      <span className="text-neutral-300">&bull;</span>
      <span className="font-mono font-medium text-neutral-600">{timeStr}</span>
    </div>
  );
}

