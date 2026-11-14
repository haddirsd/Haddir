"use client";

import { useState, type FormEvent } from "react";
import { getAdminEventEditorData, saveAdminEvent } from "./admin-events.service";
import type { AdminEventAccountForm, AdminEventFormValues, AdminEventRole, AdminEventRow, AdminTicketForm } from "./admin-events.types";

const createEmptyEventForm = (): AdminEventFormValues => ({
  title: "", description: "", category: "", city: "", venue: "", address: "",
  location_url: "", starts_at: "", ends_at: "", is_continuous: false,
  cover_image_url: "", is_trending: false, platform_fee_percent: "0",
});

const createEmptyTicket = (): AdminTicketForm => ({
  name: "تذكرة عامة", description: "", price: "", currency: "SDG",
  quantity_total: "", quantity_sold: 0, sales_start_at: "", sales_end_at: "", is_active: true,
});

const toLocalDateTimeInput = (value: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  : "";

export function useAdminEventEditor(role: AdminEventRole, loadEvents: () => Promise<void>) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [ticketForms, setTicketForms] = useState<AdminTicketForm[]>([createEmptyTicket()]);
  const [eventAccountForms, setEventAccountForms] = useState<AdminEventAccountForm[]>([]);
  const [eventForm, setEventForm] = useState<AdminEventFormValues>(createEmptyEventForm());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");

  const resetEditor = () => {
    setEditingEventId(null);
    setEventForm(createEmptyEventForm());
    setTicketForms([createEmptyTicket()]);
    setEventAccountForms([]);
    setCoverFile(null);
    setCoverPreview("");
  };

  const startNewEvent = () => {
    resetEditor();
    setEventMessage("");
    setShowEventForm(true);
  };

  const toggleEventForm = () => {
    if (showEventForm) {
      setShowEventForm(false);
      return;
    }
    startNewEvent();
  };

  const closeEventForm = () => {
    setShowEventForm(false);
    setEditingEventId(null);
    setEventMessage("");
  };

  const editEvent = async (row: AdminEventRow) => {
    setEditingEventId(row.id);
    setEventForm({
      ...createEmptyEventForm(),
      title: row.title || "", description: row.description || "", category: row.category || "",
      city: row.city || "", venue: row.venue || "", address: row.address || "",
      location_url: row.location_url || "", starts_at: toLocalDateTimeInput(row.starts_at),
      ends_at: toLocalDateTimeInput(row.ends_at), is_continuous: !!row.is_continuous,
      cover_image_url: row.cover_image_url || "", is_trending: !!row.is_trending,
      platform_fee_percent: String(row.platform_fee_percent ?? 0),
    });
    setCoverFile(null);
    setCoverPreview(row.cover_image_url || "");
    setShowEventForm(true);
    setEventMessage("");
    const result = await getAdminEventEditorData(row.id);
    if (result.error || !result.data) {
      setEventMessage(result.error || "تعذر تحميل تفاصيل الفعالية.");
      return;
    }
    setEventAccountForms(result.data.paymentAccounts);
    setTicketForms(result.data.tickets.length ? result.data.tickets : [createEmptyTicket()]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role || !["owner", "admin"].includes(role)) return;
    setSavingEvent(true);
    setEventMessage("");
    try {
      const result = await saveAdminEvent({
        eventForm, ticketForms, eventAccountForms, coverFile, editingEventId,
      });
      if (result.error) {
        setEventMessage(result.error);
        return;
      }
      setEventMessage(result.message || "تم حفظ الفعالية بنجاح.");
      resetEditor();
      setShowEventForm(false);
      await loadEvents();
    } catch (error) {
      setEventMessage(error instanceof Error ? error.message : "تعذر حفظ الفعالية.");
    } finally {
      setSavingEvent(false);
    }
  };

  return {
    showEventForm, setShowEventForm, savingEvent, eventMessage, setEventMessage,
    editingEventId, ticketForms, setTicketForms, eventAccountForms, setEventAccountForms,
    eventForm, setEventForm, coverFile, setCoverFile, coverPreview, setCoverPreview,
    emptyTicket: createEmptyTicket, toggleEventForm, closeEventForm, editEvent, createEvent,
  };
}
