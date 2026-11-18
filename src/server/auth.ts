import { createClient } from "@/lib/supabase/server";
import { jakartaDate } from "@/domain/workflow";
import { cache } from "react";
import { cookies } from "next/headers";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  systemRole: "USER" | "SUPER_ADMIN";
  isActive: boolean;
  position?: {
    id: string;
    code: string;
    name: string;
    level: number;
  };
  unit?: {
    id: string;
    code: string;
    name: string;
  };
  isOfficialSigner: boolean;
  isSuperAdmin: boolean;
}

/** Hapus cookie demo lama. Identitas hanya diverifikasi melalui Supabase Auth. */
export async function clearLocalSession() {
  cookies().set("siadocs_session", "", { path: "/", maxAge: 0 });
}

export const getCurrentUser = cache(async (): Promise<UserProfile | null> => {
  // 2. Cek sesi resmi dari Supabase Auth (hanya jika ada cookie auth, menghindari lag jaringan)
  try {
    const cookieStore = cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

    if (hasAuthCookie) {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "*,assignments:user_assignments!user_assignments_profile_id_fkey(id,is_active,is_official_signer,start_date,end_date,position:positions(id,code,name,level,is_active),unit:organizational_units!user_assignments_unit_id_fkey(id,code,name,is_active))",
          )
          .eq("id", user.id)
          .single();

        if (profile && profile.is_active) {
          const today = jakartaDate();
          const assignment = ((profile.assignments as any[]) || [])
            .filter(
              (a) =>
                a.is_active &&
                a.position?.is_active &&
                a.unit?.is_active &&
                (!a.start_date || a.start_date <= today) &&
                (!a.end_date || a.end_date >= today),
            )
            .sort((a, b) =>
              (b.start_date || "").localeCompare(a.start_date || ""),
            )[0];

          const pos = assignment?.position as unknown as
            | { id: string; code: string; name: string; level: number }
            | undefined;
          const unit = assignment?.unit as unknown as
            | { id: string; code: string; name: string }
            | undefined;

          return {
            id: profile.id,
            fullName: profile.full_name || user.email || "Pengguna SIA",
            email: profile.email || user.email || "",
            systemRole: profile.system_role as "USER" | "SUPER_ADMIN",
            isActive: profile.is_active,
            position: pos,
            unit: unit,
            isOfficialSigner: !!assignment?.is_official_signer,
            isSuperAdmin: profile.system_role === "SUPER_ADMIN",
          };
        }
      }
    }
  } catch {
    // Supabase auth check fallback
  }

  // Pengunjung tanpa sesi harus masuk melalui halaman login.
  return null;
});

/**
 * Memeriksa apakah pengguna aktif memiliki peran Super Admin.
 */
export async function requireSuperAdmin(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    throw new Error(
      "UNAUTHORIZED: Akses hanya diperuntukkan bagi Super Admin.",
    );
  }
  return user;
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user?.isActive) throw new Error("Silakan masuk menggunakan akun aktif.");
  return user;
}
