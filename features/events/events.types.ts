export type EventTier = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceValue: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  available: number;
  availableNow: boolean;
};

export type EventItem = {
  id: string;
  date: string;
  title: string;
  place: string;
  category: string;
  price: string;
  cover: string;
  coverImageUrl: string | null;
  tag: string;
  time: string;
  venue: string;
  status: string;
  map: string;
  about: string;
  isTrending: boolean;
  tiers: EventTier[];
};

export type PublicEventsResult = {
  events: EventItem[];
  ticketTypesError: string;
};
