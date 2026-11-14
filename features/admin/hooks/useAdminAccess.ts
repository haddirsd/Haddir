"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminRole } from "../types";

export function useAdminAccess() {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
      setLoading(false);
      return;
    }

    let alive = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;
      if (profileError || !profile || !["owner", "admin", "supervisor"].includes(profile.role)) {
        setError("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        setLoading(false);
        return;
      }

      setRole(profile.role as AdminRole);
      const metadata = user.user_metadata || {};
      setName(profile.full_name || metadata.full_name || metadata.name || user.email || "فريق حاضر");
      setAvatarUrl(String(metadata.avatar_url || metadata.picture || metadata.photo_url || ""));
      setLoading(false);
    };

    void init();
    return () => {
      alive = false;
    };
  }, [router]);

  return { role, name, avatarUrl, loading, error };
}
