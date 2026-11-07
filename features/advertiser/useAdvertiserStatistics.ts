"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAdvertiserEventStatistics } from "./advertiser.service";
import type { AdvertiserStatistics } from "./advertiser.types";

type AuthUser = { id: string } | null;

export function useAdvertiserStatistics(authUser: AuthUser, userRole: string) {
  const [show, setShow] = useState(false);
  const [statistics, setStatistics] = useState<AdvertiserStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setShow(false); setStatistics(null); setLoading(false); setError("");
  }, [authUser?.id, userRole]);

  const open = useCallback(async () => {
    if (!authUser || userRole !== "advertiser") return;
    const currentRequest = ++requestId.current;
    setShow(true); setLoading(true); setError(""); setStatistics(null);
    try {
      const result = await getAdvertiserEventStatistics();
      if (currentRequest !== requestId.current) return;
      if (result.error) setError(result.error);
      else setStatistics(result.data);
    } catch (reason) {
      if (currentRequest !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : "تعذر تحميل إحصائيات الفعالية.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [authUser, userRole]);

  const close = useCallback(() => {
    requestId.current += 1;
    setShow(false);
    setLoading(false);
  }, []);

  return { show, statistics, loading, error, open, close };
}
