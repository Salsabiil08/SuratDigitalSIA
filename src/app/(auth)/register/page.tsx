'use client';
import {ActionNotice} from "@/components/ui/action-notice";

import * as React from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { registerAction } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

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
      Daftar Akun & Masuk
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, null);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-sans">
      {/* Hero Panel (Kiri) */}
      <section className="relative overflow-hidden flex-1 bg-gradient-to-br from-[#121A22] via-[#1E1417] to-[#B30B0B] text-white p-8 sm:p-14 lg:p-16 flex flex-col justify-between min-h-[300px] lg:min-h-screen">
        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B30B0B] to-[#F26A0F] flex items-center justify-center font-bold text-white text-lg shadow-md">
            S
          </div>
          <span className="font-display font-extrabold text-[34px] tracking-tight leading-none text-white">
            SIADocs
          </span>
        </div>

        {/* Hero Tagline */}
        <div className="max-w-md my-8 relative z-10">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#FFB27A] mb-3">
            Pendaftaran Pengguna Baru
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
            Bergabung dengan Persuratan Digital PT Semen Indonesia Aceh
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            Daftarkan akun kerja Anda untuk mulai membuat surat, mengambil nomor resmi, dan memproses disposisi secara digital.
          </p>
        </div>

        {/* Footer info */}
        <div className="text-xs text-neutral-400 relative z-10">
          PT Semen Indonesia (Persero) Tbk.
        </div>

        {/* Bottom Accent line */}
        <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-gradient-to-r from-[#B30B0B] via-[#E62314] to-[#F26A0F] z-20" />
      </section>

      {/* Form Panel (Kanan) */}
      <section className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-page-gradient">
        <div className="w-full max-w-[440px] bg-white p-8 sm:p-10 rounded-2xl border border-[#E4E4E0] shadow-card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 m-0">Daftar Akun Baru</h2>
            <p className="text-xs text-neutral-500 mt-1 m-0">
              Lengkapi data berikut untuk membuat akun pengguna
            </p>
          </div>

          {state?.error && <ActionNotice eventKey={state} kind={"error"}>{state.error}</ActionNotice>}

          <form action={formAction} className="flex flex-col gap-3.5">
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

            <Field label="Kata Sandi (Minimal 6 karakter)" htmlFor="reg-password" required>
              <Input
                id="reg-password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Unit Kerja" htmlFor="reg-unit" required>
                <Select id="reg-unit" name="unitCode" required defaultValue="ACH">
                  <option value="ACH">Accounting (ACH)</option>
                  <option value="FIN">Finance (FIN)</option>
                  <option value="RPT">Reporting (RPT)</option>
                  <option value="HRD">Human Resources (HRD)</option>
                  <option value="OPR">Operasional (OPR)</option>
                  <option value="DIR">Direksi (DIR)</option>
                </Select>
              </Field>

              <Field label="Jabatan" htmlFor="reg-pos" required>
                <Select id="reg-pos" name="positionCode" required defaultValue="STF">
                  <option value="STF">Staff / PIC</option>
                  <option value="GM">GM / Kepala Unit</option>
                  <option value="SM">Senior Manager</option>
                  <option value="DIR">Direktur Utama</option>
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
          </form>
        </div>
      </section>
    </div>
  );
}

