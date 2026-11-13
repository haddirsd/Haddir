"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AssignedEvent, AuthUser } from "../types";

type UseAuthOptions = { onSignedOut?: () => void };

export function useAuth({ onSignedOut }: UseAuthOptions = {}) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState("customer");
  const [assignedEvent, setAssignedEvent] = useState<AssignedEvent | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const signedOutRef = useRef(onSignedOut);
  signedOutRef.current = onSignedOut;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("تسجيل الدخول يحتاج إعداد مفاتيح Supabase في بيئة الموقع.");
      return;
    }

    let alive = true;
    const load = async (user: AuthUser | null) => {
      if (!alive) return;
      setAuthUser(user);

      if (!user) {
        setUserRole("customer");
        setAssignedEvent(null);
        setFullName("");
        setEmail("");
        setPhone("");
        setAvatarUrl("");
        setProfileEditing(false);
        setSaved(false);
        signedOutRef.current?.();
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role,full_name,phone")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;

      setUserRole(data?.role || "customer");
      const { data: assignmentRows } = await supabase
        .from("event_role_assignments")
        .select("event_id,assignment_role,events(id,title,venue,city,starts_at,status)")
        .eq("user_id", user.id)
        .in("assignment_role", ["gatekeeper", "organizer", "advertiser"])
        .limit(1);
      if (!alive) return;

      const assignment = assignmentRows?.[0];
      const relatedEvent = Array.isArray(assignment?.events)
        ? assignment.events[0]
        : assignment?.events;
      setAssignedEvent(assignment ? {
        event_id: String(assignment.event_id),
        events: relatedEvent ? {
          title: relatedEvent.title || undefined,
          venue: relatedEvent.venue || undefined,
          city: relatedEvent.city || undefined,
          starts_at: relatedEvent.starts_at || undefined,
        } : undefined,
      } as AssignedEvent : null);
      const metadataName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
      const metadataAvatar = String(user.user_metadata?.avatar_url || user.user_metadata?.picture || "");
      setFullName(String(data?.full_name || metadataName || ""));
      setPhone(String(data?.phone || ""));
      setEmail(user.email || "");
      setAvatarUrl(metadataAvatar);

      let bookingPhoneRequired = false;
      try {
        bookingPhoneRequired = window.sessionStorage.getItem("haddir_booking_phone_required") === "1";
        if (bookingPhoneRequired) window.sessionStorage.removeItem("haddir_booking_phone_required");
      } catch {}
      setProfileEditing(bookingPhoneRequired && !String(data?.phone || "").trim());
      if (bookingPhoneRequired && !String(data?.phone || "").trim()) {
        setAuthMessage("أضف رقم جوالك لمواصلة الحجز.");
      }
      setSaved(false);
    };

    void supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    authUser, userRole, assignedEvent, fullName, setFullName, email, setEmail,
    phone, setPhone, avatarUrl, profileEditing, setProfileEditing, saved,
    setSaved, authMessage, setAuthMessage,
  };
}
