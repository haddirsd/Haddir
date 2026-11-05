export type EventPaymentAccount = {
  id: string;
  account_name: string;
  account_number: string;
  beneficiary: string;
};

export type BookingCreationResult = {
  booking_id: string;
  booking_number?: string | null;
};
