"use client";

import { useState } from "react";
import { formatEventDate } from "../../events/events.formatters";
import { downloadTicketAsImage } from "../utils/ticket-image";
import type { CustomerTicket } from "../types";

type TicketFilter = "new" | "used";

export function useCustomerTicketsView(
  setNotice: (message: string) => void,
) {
  const [filter, setFilter] = useState<TicketFilter>("new");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const changeFilter = (nextFilter: TicketFilter) => {
    setFilter(nextFilter);
    setExpandedTicketId(null);
  };

  const toggleTicket = (ticketId: string) => {
    setExpandedTicketId((current) =>
      current === ticketId ? null : ticketId,
    );
  };

  const downloadTicket = async (ticket: CustomerTicket) => {
    try {
      await downloadTicketAsImage(ticket, formatEventDate);
    } catch (error) {
      console.error("Ticket image export failed", error);
      setNotice("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");
    }
  };

  return {
    filter,
    expandedTicketId,
    changeFilter,
    toggleTicket,
    downloadTicket,
  };
}
