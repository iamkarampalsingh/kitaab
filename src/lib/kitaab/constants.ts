export const BOOK_KINDS = ["home", "office", "trip", "book"] as const;
export type BookKind = (typeof BOOK_KINDS)[number];

export const CASHFLOWS = ["tab", "pot", "household"] as const;
export type Cashflow = (typeof CASHFLOWS)[number];

export const COVER_TONES = [
  "linen",
  "moss",
  "clay",
  "steel",
  "dusk",
  "ink",
] as const;
export type CoverTone = (typeof COVER_TONES)[number];

export const ROLES = ["owner", "approver", "contributor", "viewer"] as const;
export type MemberRole = (typeof ROLES)[number];

export const MEMBER_STATUSES = ["active", "left", "removed"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const BOOK_STATUSES = ["open", "locked", "archived"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const APPROVAL = ["none", "pending", "approved", "reimbursed"] as const;
export type ApprovalStatus = (typeof APPROVAL)[number];

export const CATEGORIES = [
  "food",
  "groceries",
  "stay",
  "travel",
  "rent",
  "utilities",
  "supplies",
  "health",
  "shopping",
  "activities",
  "other",
] as const;

export const KIND_COPY: Record<
  BookKind,
  { label: string; blurb: string; defaultCashflow: Cashflow }
> = {
  home: {
    label: "Home",
    blurb: "A household ledger. Insight, not IOUs.",
    defaultCashflow: "household",
  },
  office: {
    label: "Office",
    blurb: "Receipts, roles, and a paper trail.",
    defaultCashflow: "tab",
  },
  trip: {
    label: "Trip",
    blurb: "A shared pot that closes with a reckoning.",
    defaultCashflow: "pot",
  },
  book: {
    label: "Book",
    blurb: "A named ledger for whoever shares it.",
    defaultCashflow: "tab",
  },
};

export const CASHFLOW_COPY: Record<
  Cashflow,
  { label: string; blurb: string; defaultCover: CoverTone }
> = {
  tab: {
    label: "Tab",
    blurb: "Pay as you go. Running balances, settle when you like.",
    defaultCover: "steel",
  },
  pot: {
    label: "Pot",
    blurb: "Everyone chips in up front. Expenses draw from the pot.",
    defaultCover: "dusk",
  },
  household: {
    label: "Household float",
    blurb: "No constant settling. Just the monthly picture.",
    defaultCover: "linen",
  },
};

export const COVER_LABEL: Record<CoverTone, string> = {
  linen: "Linen",
  moss: "Moss",
  clay: "Clay",
  steel: "Steel",
  dusk: "Dusk",
  ink: "Ink",
};

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;

export const TABS = [
  "ledger",
  "chat",
  "people",
  "reminders",
  "reckon",
] as const;
export type BookTab = (typeof TABS)[number];

export const NAME_IDEAS = [
  "Flat 4B",
  "Goa 2026",
  "Studio kitchen",
  "Cricket XI",
] as const;
