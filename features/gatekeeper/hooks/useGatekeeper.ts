"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { getGatekeeperScanHistory, getGatekeeperScanStats, submitGatekeeperTicketAction } from "../services/gatekeeper.service";
import type { GatekeeperScanHistoryItem, GatekeeperScanStats, GatekeeperTicketActionResult, GatekeeperEntryMethod } from "../types";

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
  const [lastEntryMethod, setLastEntryMethod] = useState<GatekeeperEntryMethod>("qr");
  const [gatekeeperLoading, setGatekeeperLoading] = useState(false);
  const [gatekeeperOnline, setGatekeeperOnline] = useState(true);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [gatekeeperCounts, setGatekeeperCounts] = useState<GatekeeperScanStats>(emptyStats);
  const [gatekeeperHistory, setGatekeeperHistory] = useState<GatekeeperScanHistoryItem[]>([]);
  const [gatekeeperHistoryLoading, setGatekeeperHistoryLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dataRequestSequence = useRef(0);
  const feedbackAudioContext = useRef<AudioContext | null>(null);

  const prepareFeedbackAudio = useCallback(() => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      if (!feedbackAudioContext.current) feedbackAudioContext.current = new window.AudioContext();
      if (feedbackAudioContext.current.state === "suspended") {
        void feedbackAudioContext.current.resume().catch(() => undefined);
      }
    } catch {
      // Audio feedback must never affect ticket validation.
    }
  }, []);

  const playGatekeeperFeedback = useCallback((accepted: boolean) => {
    if (typeof window === "undefined") return;
    const context = feedbackAudioContext.current;
    if (context) {
      const playTone = (startAt: number, duration: number, frequency: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.012);
        gain.gain.setValueAtTime(0.16, startAt + duration - 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
      };
      const now = context.currentTime + 0.015;
      if (accepted) playTone(now, 0.16, 880);
      else {
        playTone(now, 0.12, 660);
        playTone(now + 0.2, 0.12, 660);
      }
      if (context.state === "suspended") void context.resume().catch(() => undefined);
    }
    if (!accepted && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([140, 80, 140]);
    }
  }, []);

  useEffect(() => {
    if (!gatekeeperResult) return;
    playGatekeeperFeedback(gatekeeperResult.status === "checked_in");
  }, [gatekeeperResult, playGatekeeperFeedback]);

  const refreshGatekeeperData = useCallback(async () => {
    if (!assignedEvent?.event_id) return;
    const requestId = ++dataRequestSequence.current;
    setGatekeeperHistoryLoading(true);
    const [{ data: stats }, { data: history, error }] = await Promise.all([
      getGatekeeperScanStats(assignedEvent.event_id),
      getGatekeeperScanHistory(assignedEvent.event_id),
    ]);
    if (requestId !== dataRequestSequence.current) return;
    setGatekeeperHistoryLoading(false);
    if (stats) setGatekeeperCounts({ ...emptyStats, ...stats });
    if (!error && Array.isArray(history)) setGatekeeperHistory(history);
  }, [assignedEvent?.event_id]);

  const runGatekeeperAction = useCallback(async (
    confirm: boolean,
    codeOverride?: string,
    entryMethod: GatekeeperEntryMethod = "qr",
  ) => {
    const code = (codeOverride ?? gatekeeperCode).trim();
    if (!authUser || !assignedEvent || !code) return;
    prepareFeedbackAudio();
    if (!gatekeeperOnline) {
      setGatekeeperResult({ ok: false, status: "error", message: "لا يوجد اتصال بالإنترنت. لن يتم اعتماد الدخول قبل استعادة الاتصال." });
      return;
    }
    if (entryMethod === "manual" && !/^[0-9]{10}$/.test(code)) {
      setGatekeeperResult({ ok: false, status: "error", message: "كود التذكرة يجب أن يتكون من 10 أرقام فقط." });
      return;
    }
    setLastEntryMethod(entryMethod);
    setGatekeeperLoading(true);
    const { data, error } = await submitGatekeeperTicketAction(code, confirm, entryMethod);
    setGatekeeperLoading(false);
    if (error) setGatekeeperResult({ ok: false, status: "error", message: error.message || "تعذر التحقق من التذكرة." });
    else setGatekeeperResult(data as GatekeeperTicketActionResult);
    await refreshGatekeeperData();
  }, [authUser, assignedEvent, gatekeeperCode, gatekeeperOnline, prepareFeedbackAudio, refreshGatekeeperData]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!isGatekeeperPage || !authUser || !assignedEvent?.event_id || (userRole !== "gatekeeper" && userRole !== "organizer") || !supabase) return;
    let hasSubscribed = false;
    void refreshGatekeeperData();
    const channel = supabase.channel("gatekeeper-live-" + assignedEvent.event_id)
      .on("postgres_changes", { event: "*", schema: "public", table: "gatekeeper_scan_logs", filter: "event_id=eq." + assignedEvent.event_id }, () => { void refreshGatekeeperData(); })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refreshGatekeeperData();
          hasSubscribed = true;
        }
      });
    return () => { dataRequestSequence.current += 1; void supabase.removeChannel(channel); };
  }, [isGatekeeperPage, authUser, assignedEvent?.event_id, userRole, refreshGatekeeperData]);

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
    prepareFeedbackAudio();
    setGatekeeperResult(null);
    setManualEntryOpen(false);
    setScannerOpen(value => !value);
  };
  const acknowledgeGatekeeperResult = () => {
    setGatekeeperResult(null);
    setGatekeeperCode("");
    if (lastEntryMethod === "manual") {
      setScannerOpen(false);
      setManualEntryOpen(true);
    } else {
      setManualEntryOpen(false);
      setScannerOpen(true);
    }
  };

  const openManualEntry = () => {
    prepareFeedbackAudio();
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
    runGatekeeperAction, refreshGatekeeperData, acknowledgeGatekeeperResult,
    openScanner, openManualEntry,
  };
}
