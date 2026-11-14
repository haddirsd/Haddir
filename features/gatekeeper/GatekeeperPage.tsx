"use client";

import { useEffect } from "react";
import { useGatekeeper } from "./hooks/useGatekeeper";
import { GatekeeperWorkspace } from "./components/GatekeeperWorkspace";
import type { AuthUser, AssignedEvent } from "../auth/types";

type GatekeeperPageProps = {
  authUser: AuthUser | null;
  userRole: string;
  assignedEvent: AssignedEvent | null;
  isGatekeeperPage: boolean;
  activeWorkspace: string | null;
  onClose: () => void;
};

export function GatekeeperPage({
  authUser,
  userRole,
  assignedEvent,
  isGatekeeperPage,
  activeWorkspace,
  onClose,
}: GatekeeperPageProps) {
  const gatekeeper = useGatekeeper({
    authUser,
    assignedEvent,
    userRole,
    isGatekeeperPage,
    activeWorkspace,
  });

  useEffect(() => {
    if (!authUser) {
      gatekeeper.setGatekeeperResult(null);
      gatekeeper.setGatekeeperCode("");
    }
  }, [authUser, gatekeeper.setGatekeeperResult, gatekeeper.setGatekeeperCode]);

  return (
    <GatekeeperWorkspace
      userRole={userRole}
      assignedEvent={assignedEvent}
      online={gatekeeper.gatekeeperOnline}
      counts={gatekeeper.gatekeeperCounts}
      loading={gatekeeper.gatekeeperLoading}
      code={gatekeeper.gatekeeperCode}
      result={gatekeeper.gatekeeperResult}
      manualEntryOpen={gatekeeper.manualEntryOpen}
      scannerOpen={gatekeeper.scannerOpen}
      history={gatekeeper.gatekeeperHistory}
      historyLoading={gatekeeper.gatekeeperHistoryLoading}
      videoRef={gatekeeper.videoRef}
      onOpenScanner={gatekeeper.openScanner}
      onOpenManual={gatekeeper.openManualEntry}
      onCodeChange={gatekeeper.setGatekeeperCode}
      onManualSubmit={() => {
        gatekeeper.setScannerOpen(false);
        gatekeeper.setManualEntryOpen(false);
        void gatekeeper.runGatekeeperAction(true, gatekeeper.gatekeeperCode, "manual");
      }}
      onAcknowledgeResult={gatekeeper.acknowledgeGatekeeperResult}
      onClose={onClose}
    />
  );
}
