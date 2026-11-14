"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { getAdminNavigationSections, type AdminRole, type AdminSection } from "../types";

export function useAdminWorkspaceNavigation(role: AdminRole | null) {
  const router = useRouter();
  const [section, setAdminSection] = useState<AdminSection>("overview");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const nav = useMemo(
    () => (role ? getAdminNavigationSections(role) : []),
    [role],
  );

  const requestSignOut = () => setShowLogoutConfirm(true);
  const cancelSignOut = () => setShowLogoutConfirm(false);

  const confirmSignOut = async () => {
    setShowLogoutConfirm(false);
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/");
  };

  return {
    section,
    setAdminSection,
    userSearchTerm,
    setUserSearchTerm,
    nav,
    showLogoutConfirm,
    requestSignOut,
    cancelSignOut,
    confirmSignOut,
  };
}
