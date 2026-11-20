'use client';
import {ActionNotice} from "@/components/ui/action-notice";

import * as React from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { registerAction } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

import type {registrationOptions} from '@/server/registration';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      className="w-full mt-3 bg-gradient-to-r from-[#B30B0B] to-[#E62314] hover:from-[#8F0808] hover:to-[#B30B0B] font-bold shadow-sm"
      isLoading={pending}
    >
      Ajukan Pendaftaran
    </Button>
  );
}

export function RegisterClient({options}:{options:Awaited<ReturnType<typeof registrationOptions>>}) {
  const [state, formAction] = useFormState(registerAction, null);

  return (
    <main data-auth-scroll className="h-screen h-[100dvh] w-full overflow-y-auto overflow-x-hidden login-animated-bg font-sans">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-[440px] shrink-0">
          <div className="flex flex-col items-center mb-4 text-center">
            <Link href="/login" aria-label="SIADocs — halaman masuk" className="flex items-center gap-2.5">
              <img src="/images/logo.png" alt="SIADocs Logo" className="h-10 sm:h-11 w-auto"/>
              <img src="/images/logo-text.png" alt="SIADocs" className="h-6 sm:h-7 w-auto"/>
            </Link>
            <p className="text-[11px] text-neutral-300 mt-2">Sistem Persuratan Digital &amp; Penomoran Resmi</p>
          </div>
          <div className="w-full login-card-glass p-5 sm:p-6 rounded-2xl border border-neutral-200/80 shadow-2xl text-neutral-900">
          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 m-0">Daftar Akun Baru</h1>
            <p className="text-xs text-neutral-500 mt-1 m-0">
              Isi data Anda. Super Admin akan memeriksa dan mengaktifkan akun.
            </p>
          </div>

          {options.error&&<ActionNotice>{options.error}</ActionNotice>}
          {state?.success&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-3"><p>{state.message}</p><Link href="/login" className="text-brand-red underline font-semibold">Kembali ke Masuk</Link></div>}
          {state?.error && <ActionNotice eventKey={state} kind={"error"}>{state.error}</ActionNotice>}

          {!state?.success&&<form action={formAction} className="flex flex-col gap-3.5">
            <Field label="Nama Lengkap" htmlFor="reg-name" required>
              <Input
                id="reg-name"
                name="fullName"
                placeholder="Contoh: Rian Firmansyah"
                required
              />
            </Field>

            <Field label="Alamat Email Kantor" htmlFor="reg-email" required>
              <Input
                id="reg-email"
                name="email"
                type="email"
                placeholder="nama@sia.co.id"
                required
              />
            </Field>

            <Field label="Kata Sandi minimal 8 karakter" htmlFor="reg-password" required>
              <Input
                id="reg-password"
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="••••••••"
                required
              />
            </Field>

            <Field label="Konfirmasi Kata Sandi" htmlFor="reg-confirm" required><Input id="reg-confirm" name="confirmPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required/></Field>
            <p className="text-xs text-neutral-600">Unit dan jabatan akan diperiksa oleh Super Admin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Unit Kerja" htmlFor="reg-unit" required>
                <Select id="reg-unit" name="unitId" required defaultValue="">
                  <option value="" disabled>Pilih unit kerja</option>
                  {options.units.map(u=><option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                </Select>
              </Field>

              <Field label="Jabatan" htmlFor="reg-pos" required>
                <Select id="reg-pos" name="positionId" required defaultValue="">
                  <option value="" disabled>Pilih jabatan yang diajukan</option>
                  {options.positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            </div>

            <SubmitButton />

            <div className="text-xs text-neutral-600 text-center mt-3 pt-3 border-t border-[#EEEEEA]">
              Sudah memiliki akun?{' '}
              <Link href="/login" className="font-semibold text-brand-red hover:underline">
                Masuk di sini
              </Link>
            </div>
          </form>}
          </div>
          <p className="mt-3 text-center text-[10px] text-neutral-400">PT Semen Indonesia (Persero) Tbk.</p>
        </div>
      </div>
      <div aria-hidden="true" className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B30B0B] via-[#E62314] to-[#F26A0F] pointer-events-none"/>
    </main>
  );
}
