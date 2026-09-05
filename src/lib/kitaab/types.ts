import type {
  ApprovalStatus,
  BookKind,
  BookStatus,
  Cashflow,
  CoverTone,
  MemberRole,
  MemberStatus,
} from "./constants";

export type Person = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
};

export type BookSummary = {
  id: string;
  title: string;
  kind: BookKind;
  cashflow: Cashflow;
  coverTone: CoverTone;
  currency: string;
  budgetPaise: number | null;
  status: BookStatus;
  inviteCode: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  spentPaise: number;
  myNet: number;
  myRole: MemberRole;
  lastActivity: string | null;
  members: Person[];
};

export type Member = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
};

export type ExpenseShare = {
  userId: string;
  sharePaise: number;
  included: boolean;
};

export type Expense = {
  id: string;
  bookId: string;
  createdBy: string;
  paidBy: string;
  title: string;
  amountPaise: number;
  category: string;
  note: string | null;
  spentAt: string;
  splitMode: string;
  isPersonal: boolean;
  isTreat: boolean;
  approvalStatus: ApprovalStatus;
  hasReceipt: boolean;
  createdAt: string;
  shares: ExpenseShare[];
};

export type Balance = {
  userId: string;
  name: string;
  paidPaise: number;
  sharePaise: number;
  net: number;
};

export type PotInfo = {
  totalIn: number;
  spent: number;
  remaining: number;
  entries: { id: string; userId: string; name: string; amountPaise: number; note: string | null; createdAt: string }[];
};

export type Reminder = {
  id: string;
  bookId: string;
  createdBy: string;
  title: string;
  dueAt: string;
  assignedTo: string | null;
  done: boolean;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  bookId: string;
  userId: string | null;
  name: string;
  image: string | null;
  kind: "chat" | "expense" | "system" | "poll";
  body: string;
  expenseId: string | null;
  createdAt: string;
};

export type Settlement = {
  id: string;
  fromUser: string;
  toUser: string;
  amountPaise: number;
  method: string | null;
  note: string | null;
  createdAt: string;
};

export type BookDetail = {
  book: BookSummary;
  members: Member[];
  expenses: Expense[];
  balances: Balance[];
  transfers: { from: string; to: string; amount: number }[];
  pot: PotInfo | null;
  reminders: Reminder[];
  settlements: Settlement[];
  me: { userId: string; role: MemberRole };
};

export type Pulse = {
  coveredThisMonth: number;
  netBalance: number;
  pendingApprovals: number;
  upcomingReminders: number;
  booksOverBudget: number;
};

export type Dashboard = {
  me: Person;
  books: BookSummary[];
  pulse: Pulse;
};
