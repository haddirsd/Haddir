"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { getGatekeeperScanHistory, getGatekeeperScanStats, submitGatekeeperTicketAction } from "./gatekeeper.service";
import type { GatekeeperScanHistoryItem, GatekeeperScanStats, GatekeeperTicketActionResult, GatekeeperEntryMethod } from "./gatekeeper.types";

type GatekeeperUser = { id: string } | null;
type GatekeeperAssignment = { event_id: string; events?: { title?: string; venue?: string; city?: string; starts_at?: string } } | null;

const emptyStats: GatekeeperScanStats = { accepted: 0, used: 0, forged: 0, invalid: 0 };

export function useGatekeeper({
  authUser,
  assignedEvent,
  userRole,
  isGatekeeperPage,
  activeWorkspace,
}: {
  authUser: GatekeeperUser;
  assignedEvent: GatekeeperAssignment;
  userRole: string;
  isGatekeeperPage: boolean;
  activeWorkspace: string | null;
}) {
  const [gatekeeperCode, setGatekeeperCode] = useState("");
  const [gatekeeperResult, setGatekeeperResult] = useState<GatekeeperTicketActionResult | null>(null);
  const [gatekeeperLoading, setGatekeeperLoading] = useState(false);
  const [gatekeeperOnline, setGatekeeperOnline] = useState(true);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [gatekeeperCounts, setGatekeeperCounts] = useState<GatekeeperScanStats>(emptyStats);
  const [gatekeeperHistory, setGatekeeperHistory] = useState<GatekeeperScanHistoryItem[]>([]);
  const [gatekeeperHistoryLoading, setGatekeeperHistoryLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dataRequestSequence = useRef(0);

  const refreshGatekeeperData = useCallback(async () => {
    if (!assignedEvent?.event_id) return;
    const requestId = ++dataRequestSequence.current;
    const [{ data: stats }, { data: history, error }] = await Promise.all([
      getGatekeeperScanStats(assignedEvent.event_id),
      getGatekeeperScanHistory(assignedEvent.event_id),
    ]);
    if (requestId !== dataRequestSequence.current) return;
    if (stats) setGatekeeperCounts({ ...emptyStats, ...stats });
    if (!error && Array.isArray(history)) setGatekeeperHistory(history);
  }, [assignedEvent?.event_id]);

  const loadGatekeeperHistory = useCallback(async () => {
    if (!assignedEvent?.event_id) return;
    setGatekeeperHistoryLoading(true);
    const { data, error } = await getGatekeeperScanHistory(assignedEvent.event_id);
    setGatekeeperHistoryLoading(false);
    if (!error && Array.isArray(data)) setGatekeeperHistory(data);
  }, [assignedEvent?.event_id]);

  const runGatekeeperAction = useCallback(async (
    confirm: boolean,
    codeOverride?: string,
    entryMethod: GatekeeperEntryMethod = "qr",
  ) => {
    const code = (codeOverride ?? gatekeeperCode).trim();
    if (!authUser || !assignedEvent || !code) return;
    if (!gatekeeperOnline) {
      setGatekeeperResult({ ok: false, status: "error", message: "لا يوجد اتصال بالإنترنت. لن يتم اعتماد الدخول قبل استعادة الاتصال." });
      return;
    }
    if (entryMethod === "manual" && !/^[0-9]{10}$/.test(code)) {
      setGatekeeperResult({ ok: false, status: "error", message: "كود التذكرة يجب أن يتكون من 10 أرقام فقط." });
      return;
    }
    setGatekeeperLoading(true);
    const { data, error } = await submitGatekeeperTicketAction(code, confirm, entryMethod);
    setGatekeeperLoading(false);
    if (error) setGatekeeperResult({ ok: false, status: "error", message: error.message || "تعذر التحقق من التذكرة." });
    else setGatekeeperResult(data as GatekeeperTicketActionResult);
    await refreshGatekeeperData();
  }, [authUser, assignedEvent, gatekeeperCode, gatekeeperOnline, refreshGatekeeperData]);

  useEffect(() => {
    if (!authUser || !assignedEvent?.event_id || (userRole !== "gatekeeper" && userRole !== "organizer")) return;
    void refreshGatekeeperData();
  }, [authUser, assignedEvent?.event_id, userRole, refreshGatekeeperData]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!isGatekeeperPage || !authUser || !assignedEvent?.event_id || (userRole !== "gatekeeper" && userRole !== "organizer") || !supabase) return;
    let alive = true;
    let hasSubscribed = false;
    const refresh = async () => {
      const [{ data: stats }, { data: history, error }] = await Promise.all([
        getGatekeeperScanStats(assignedEvent.event_id),
        getGatekeeperScanHistory(assignedEvent.event_id),
      ]);
      if (!alive) return;
      if (stats) setGatekeeperCounts({ ...emptyStats, ...stats });
      if (!error && Array.isArray(history)) setGatekeeperHistory(history);
    };
    void refresh();
    const channel = supabase.channel("gatekeeper-live-" + assignedEvent.event_id)
      .on("postgres_changes", { event: "*", schema: "public", table: "gatekeeper_scan_logs", filter: "event_id=eq." + assignedEvent.event_id }, () => { void refresh(); })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refresh();
          hasSubscribed = true;
        }
      });
    return () => { alive = false; dataRequestSequence.current += 1; void supabase.removeChannel(channel); };
  }, [isGatekeeperPage, authUser, assignedEvent?.event_id, userRole]);

  useEffect(() => {
    const update = () => setGatekeeperOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!scannerOpen || activeWorkspace !== "gatekeeper") return;
    let stopped = false;
    let scannerControls: { stop: () => void } | undefined;
    const start = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 500 });
        scannerControls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          video,
          (result, _error, controls) => {
            if (stopped || !result) return;
            const value = result.getText().trim();
            if (!/^[A-Za-z0-9]{10}$/.test(value)) {
              setGatekeeperResult({ ok: false, status: "error", message: "الرمز مقروء، لكن محتواه لا يطابق كود تذكرة حاضر المكوّن من 10 خانات." });
              return;
            }
            stopped = true;
            controls.stop();
            setGatekeeperCode(value.toUpperCase());
            setScannerOpen(false);
            setGatekeeperResult(null);
            void runGatekeeperAction(true, value);
          },
        );
      } catch (error) {
        if (stopped) return;
        const message = error instanceof Error ? error.message : "";
        setGatekeeperResult({
          ok: false,
          status: "error",
          message: message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")
            ? "إذن الكاميرا مرفوض. اسمح للمتصفح باستخدام الكاميرا ثم أعد المحاولة."
            : "تعذر تشغيل قارئ QR أو الكاميرا. تأكد من إذن الكاميرا واتصال HTTPS، أو أدخل كود التذكرة يدوياً.",
        });
      }
    };
    void start();
    return () => { stopped = true; scannerControls?.stop(); };
  }, [scannerOpen, activeWorkspace, runGatekeeperAction]);

  const openScanner = () => {
    setGatekeeperResult(null);
    setManualEntryOpen(false);
    setScannerOpen(value => !value);
  };
  const openManualEntry = () => {
    setScannerOpen(false);
    setGatekeeperResult(null);
    setManualEntryOpen(true);
  };

  return {
    gatekeeperCode, setGatekeeperCode,
    gatekeeperResult, setGatekeeperResult,
    gatekeeperLoading, gatekeeperOnline,
    manualEntryOpen, setManualEntryOpen,
    gatekeeperCounts, gatekeeperHistory, gatekeeperHistoryLoading,
    scannerOpen, setScannerOpen, videoRef,
    runGatekeeperAction, loadGatekeeperHistory, refreshGatekeeperData,
    openScanner, openManualEntry,
  };
}
