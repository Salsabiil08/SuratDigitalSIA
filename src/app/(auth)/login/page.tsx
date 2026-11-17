'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="sm"
      className="w-full mt-1.5 font-bold shadow-md h-9 sm:h-10 text-xs sm:text-sm"
      isLoading={pending}
    >
      Masuk
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-5 login-animated-bg font-sans relative overflow-x-hidden overflow-y-auto">
      {/* ========================================================================= */}
      {/* AMBIENT GLOW LEMBUT SESUAI GAMBAR HERO KIRI (ELEGAN, TIDAK MERAH MENYALA) */}
      {/* ========================================================================= */}
      <div
        className="w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full bg-[#1A2838] opacity-30 blur-[100px] pointer-events-none absolute -top-16 -left-16 animate-ambient-orb-1"
        aria-hidden="true"
      />
      <div
        className="w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] rounded-full bg-[#B30B0B] opacity-22 blur-[130px] pointer-events-none absolute -bottom-16 -right-16 animate-ambient-orb-2"
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* KONTAINER UTAMA: PAS 1 LAYAR DESKTOP, TIDAK TERPOTONG                    */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-[390px] sm:max-w-[405px] flex flex-col items-center py-2 sm:py-4">
        {/* LOGO DI ATAS KOTAK LOGIN */}
        <div className="flex flex-col items-center mb-3 sm:mb-4 text-center">
          <div className="animate-logo-float flex items-center justify-center gap-2.5 transition-transform duration-200 hover:scale-105 cursor-pointer">
            <img
              src="/images/logo.png"
              alt="SIADocs Logo"
              className="h-10 sm:h-11 w-auto object-contain drop-shadow-[0_4px_16px_rgba(230,35,20,0.4)] shrink-0"
            />
            <img
              src="/images/logo-text.png"
              alt="SIADocs"
              className="h-6 sm:h-7 w-auto object-contain drop-shadow-sm shrink-0"
            />
          </div>
          <p className="text-[11px] text-neutral-300/85 mt-1 font-medium tracking-wide">
            Sistem Persuratan Digital & Penomoran Resmi
          </p>
        </div>

        {/* KOTAK LOGIN DI TENGAH (KOMPAK, RAPI, BERSIH) */}
        <div className="w-full login-card-glass p-5 sm:p-6 rounded-2xl border border-neutral-200/80 shadow-2xl text-neutral-900">
          <div className="mb-3.5 text-center">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 m-0">
              Masuk ke akun Anda
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5 m-0">
              Gunakan email kantor atau daftar akun baru
            </p>
          </div>

          {state?.error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-2.5 sm:gap-3">
            <div>
              <label htmlFor="login-email" className="text-xs font-semibold text-neutral-700 block mb-1">
                Alamat email <span className="text-red-500">*</span>
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="nama@perusahaan.co.id"
                required
                className="w-full min-h-[36px] sm:min-h-[38px] px-3 py-1 text-xs bg-neutral-50 border border-[#C9C9C3] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red focus:bg-white text-neutral-900 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="text-xs font-semibold text-neutral-700 block mb-1">
                Kata sandi <span className="text-red-500">*</span>
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full min-h-[36px] sm:min-h-[38px] px-3 py-1 text-xs bg-neutral-50 border border-[#C9C9C3] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red focus:bg-white text-neutral-900 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-600 pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-[#C9C9C3] text-brand-red focus:ring-brand-red cursor-pointer w-3.5 h-3.5"
                />
                <span className="text-[11px]">Ingat saya</span>
              </label>
              <Link href="#" className="text-[11px] text-brand-red hover:underline font-medium">
                Lupa kata sandi?
              </Link>
            </div>

            <SubmitButton />

            {/* Link Daftar Akun Baru */}
            <div className="text-[11px] text-neutral-600 text-center py-0.5">
              Belum memiliki akun?{' '}
              <Link href="/register" className="font-bold text-brand-red hover:underline">
                Daftar Akun Baru &rarr;
              </Link>
            </div>
          </form>


        </div>

        {/* Footer Info Perusahaan */}
        <div className="mt-2.5 text-center text-[10px] text-neutral-400/80 font-medium tracking-wide">
          PT Semen Indonesia (Persero) Tbk.
        </div>
      </div>

      {/* Garis Aksen Bawah Halus (1px, tidak bertabrakan) */}
      <div
        className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B30B0B] via-[#E62314] to-[#F26A0F] z-20 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
