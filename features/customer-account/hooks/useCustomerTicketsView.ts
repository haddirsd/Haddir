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
  const [page, setPage] = useState(1);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const changeFilter = (nextFilter: TicketFilter) => {
    setFilter(nextFilter);
    setPage(1);
    setExpandedTicketId(null);
  };

  const changePage = (nextPage: number) => {
    setPage(Math.max(1, nextPage));
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
    page,
    expandedTicketId,
    changeFilter,
    changePage,
    toggleTicket,
    downloadTicket,
  };
}
