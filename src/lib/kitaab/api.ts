import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { inviteCode, nid } from "@/lib/utils";
import { simplifyDebts, splitEqual } from "./money";
import {
  BOOK_KINDS,
  CASHFLOWS,
  COVER_TONES,
  type BookKind,
  type Cashflow,
  type CoverTone,
  type MemberRole,
  type ApprovalStatus,
  type BookStatus,
} from "./constants";
import type {
  Balance,
  BookDetail,
  BookSummary,
  ChatMessage,
  Dashboard,
  Expense,
  Member,
  Person,
  PotInfo,
  Reminder,
  Settlement,
} from "./types";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
};

type BookRow = {
  id: string;
  creator_id: string;
  title: string;
  kind: string;
  cashflow: string;
  cover_tone: string;
  currency: string;
  budget_paise: number | null;
  description: string | null;
  status: string;
  invite_code: string;
  created_at: string;
};

type MemberRow = {
  id: string;
  book_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  left_at: string | null;
};

function person(u: UserRow): Person {
  return {
    id: u.id,
    name: u.name || u.email || "Member",
    email: u.email,
    image: u.image,
  };
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return String(v ?? "");
}

function ymd(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? "").slice(0, 10);
}

function asBool(v: unknown) {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

async function loadUser(userId: string) {
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select id, name, email, image from "user" where id = ${userId}
  `;
  if (rows[0]) return person(rows[0]);
  return { id: userId, name: "Member", email: null, image: null };
}

async function loadUsers(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Person>();
  if (unique.length === 0) return map;
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select id, name, email, image from "user" where id = any(${unique}::text[])
  `;
  for (const r of rows) map.set(r.id, person(r));
  for (const id of unique) {
    if (!map.has(id)) map.set(id, { id, name: "Member", email: null, image: null });
  }
  return map;
}

async function requireMember(userId: string, bookId: string) {
  const sql = await getSql();
  const rows = await sql<
    MemberRow & Omit<BookRow, "id" | "status"> & { book_status: string }
  >`
    select m.id, m.book_id, m.user_id, m.role, m.status, m.joined_at, m.left_at,
           b.creator_id, b.title, b.kind, b.cashflow, b.cover_tone, b.currency,
           b.budget_paise, b.description, b.status as book_status, b.invite_code, b.created_at
    from members m
    join books b on b.id = m.book_id
    where m.book_id = ${bookId} and m.user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || row.status !== "active") {
    throw new Error("You are not in this book.");
  }
  return {
    member: {
      id: row.id,
      bookId: row.book_id,
      userId: row.user_id,
      role: row.role as MemberRole,
      status: row.status,
      joinedAt: iso(row.joined_at),
    },
    book: {
      id: row.book_id,
      creatorId: row.creator_id,
      title: row.title,
      kind: (BOOK_KINDS.includes(row.kind as BookKind) ? row.kind : "book") as BookKind,
      cashflow: (CASHFLOWS.includes(row.cashflow as Cashflow) ? row.cashflow : "tab") as Cashflow,
      coverTone: row.cover_tone as CoverTone,
      currency: row.currency,
      budgetPaise: row.budget_paise,
      description: row.description,
      status: row.book_status as BookStatus,
      inviteCode: row.invite_code,
      createdAt: iso(row.created_at),
    },
  };
}

function canWrite(role: MemberRole, status: BookStatus) {
  if (status === "locked" || status === "archived") return false;
  return role === "owner" || role === "approver" || role === "contributor";
}

function isOwnerish(role: MemberRole) {
  return role === "owner" || role === "approver";
}

async function postSystem(bookId: string, body: string, expenseId?: string) {
  const sql = await getSql();
  await sql`
    insert into messages (id, book_id, user_id, kind, body, expense_id)
    values (${nid("msg")}, ${bookId}, null, ${expenseId ? "expense" : "system"}, ${body}, ${expenseId ?? null})
  `;
}

type ExpenseRow = {
  id: string;
  book_id: string;
  created_by: string;
  paid_by: string;
  title: string;
  amount_paise: number;
  category: string;
  note: string | null;
  spent_at: string;
  split_mode: string;
  is_personal: boolean;
  is_treat: boolean;
  approval_status: string;
  created_at: string;
  has_receipt: boolean | number;
};

function mapExpense(
  r: ExpenseRow,
  shares: { userId: string; sharePaise: number; included: boolean }[],
): Expense {
  return {
    id: r.id,
    bookId: r.book_id,
    createdBy: r.created_by,
    paidBy: r.paid_by,
    title: r.title,
    amountPaise: Number(r.amount_paise),
    category: r.category,
    note: r.note,
    spentAt: ymd(r.spent_at),
    splitMode: r.split_mode,
    isPersonal: asBool(r.is_personal),
    isTreat: asBool(r.is_treat),
    approvalStatus: r.approval_status as ApprovalStatus,
    hasReceipt: asBool(r.has_receipt),
    createdAt: iso(r.created_at),
    shares,
  };
}

async function loadExpenses(bookId: string): Promise<Expense[]> {
  const sql = await getSql();
  const rows = await sql<ExpenseRow>`
    select e.*,
      exists(select 1 from receipts r where r.expense_id = e.id) as has_receipt
    from expenses e
    where e.book_id = ${bookId}
    order by e.spent_at desc, e.created_at desc
  `;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const shareRows = await sql<{
    expense_id: string;
    user_id: string;
    share_paise: number;
    included: boolean;
  }>`
    select expense_id, user_id, share_paise, included
    from expense_shares
    where expense_id = any(${ids}::text[])
  `;
  const byExp = new Map<string, Expense["shares"]>();
  for (const s of shareRows) {
    const list = byExp.get(s.expense_id) ?? [];
    list.push({
      userId: s.user_id,
      sharePaise: Number(s.share_paise),
      included: asBool(s.included),
    });
    byExp.set(s.expense_id, list);
  }
  return rows.map((r) => mapExpense(r, byExp.get(r.id) ?? []));
}

function countsTowardBalance(e: Expense) {
  if (e.isPersonal || e.isTreat) return false;
  if (e.approvalStatus === "pending") return false;
  return true;
}

function countsTowardSpend(e: Expense) {
  if (e.isPersonal) return false;
  if (e.approvalStatus === "pending") return false;
  return true;
}

function computeBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[],
): Balance[] {
  const map = new Map<string, Balance>();
  for (const m of members) {
    map.set(m.userId, {
      userId: m.userId,
      name: m.name,
      paidPaise: 0,
      sharePaise: 0,
      net: 0,
    });
  }
  const bump = (userId: string, nameFallback: string) => {
    let row = map.get(userId);
    if (!row) {
      row = { userId, name: nameFallback, paidPaise: 0, sharePaise: 0, net: 0 };
      map.set(userId, row);
    }
    return row;
  };
  for (const e of expenses) {
    if (!countsTowardBalance(e)) continue;
    bump(e.paidBy, "Member").paidPaise += e.amountPaise;
    for (const s of e.shares) {
      if (!s.included) continue;
      bump(s.userId, "Member").sharePaise += s.sharePaise;
    }
  }
  for (const s of settlements) {
    bump(s.fromUser, "Member").sharePaise += s.amountPaise;
    bump(s.toUser, "Member").paidPaise += s.amountPaise;
  }
  for (const row of map.values()) {
    row.net = row.paidPaise - row.sharePaise;
  }
  return [...map.values()];
}

async function loadSettlements(bookId: string): Promise<Settlement[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    from_user: string;
    to_user: string;
    amount_paise: number;
    method: string | null;
    note: string | null;
    created_at: string;
  }>`
    select id, from_user, to_user, amount_paise, method, note, created_at
    from settlements where book_id = ${bookId} order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    fromUser: r.from_user,
    toUser: r.to_user,
    amountPaise: Number(r.amount_paise),
    method: r.method,
    note: r.note,
    createdAt: iso(r.created_at),
  }));
}

async function loadMembers(bookId: string): Promise<Member[]> {
  const sql = await getSql();
  const rows = await sql<MemberRow>`
    select id, book_id, user_id, role, status, joined_at, left_at
    from members where book_id = ${bookId} order by joined_at
  `;
  const users = await loadUsers(rows.map((r) => r.user_id));
  return rows.map((r) => {
    const u = users.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      name: u?.name ?? "Member",
      email: u?.email ?? null,
      image: u?.image ?? null,
      role: r.role as MemberRole,
      status: r.status as Member["status"],
      joinedAt: iso(r.joined_at),
    };
  });
}

async function loadPot(bookId: string, expenses: Expense[]): Promise<PotInfo> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    user_id: string;
    amount_paise: number;
    note: string | null;
    created_at: string;
  }>`
    select id, user_id, amount_paise, note, created_at
    from pot_entries where book_id = ${bookId} order by created_at
  `;
  const users = await loadUsers(rows.map((r) => r.user_id));
  const entries = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: users.get(r.user_id)?.name ?? "Member",
    amountPaise: Number(r.amount_paise),
    note: r.note,
    createdAt: iso(r.created_at),
  }));
  const totalIn = entries.reduce((s, e) => s + e.amountPaise, 0);
  const spent = expenses.filter(countsTowardSpend).reduce((s, e) => s + e.amountPaise, 0);
  return { totalIn, spent, remaining: totalIn - spent, entries };
}

async function toSummary(
  book: BookRow,
  members: Member[],
  expenses: Expense[],
  myUserId: string,
  settlements: Settlement[],
): Promise<BookSummary> {
  const me = members.find((m) => m.userId === myUserId && m.status === "active");
  const balances = computeBalances(members, expenses, settlements);
  const myNet = balances.find((b) => b.userId === myUserId)?.net ?? 0;
  const spent = expenses.filter(countsTowardSpend).reduce((s, e) => s + e.amountPaise, 0);
  const last =
    expenses[0]?.createdAt ??
    members.reduce<string | null>((acc, m) => (acc && acc > m.joinedAt ? acc : m.joinedAt), null);
  return {
    id: book.id,
    title: book.title,
    kind: (BOOK_KINDS.includes(book.kind as BookKind) ? book.kind : "book") as BookKind,
    cashflow: (CASHFLOWS.includes(book.cashflow as Cashflow) ? book.cashflow : "tab") as Cashflow,
    coverTone: book.cover_tone as CoverTone,
    currency: book.currency,
    budgetPaise: book.budget_paise,
    status: book.status as BookStatus,
    inviteCode: book.invite_code,
    description: book.description,
    createdAt: iso(book.created_at),
    memberCount: members.filter((m) => m.status === "active").length,
    spentPaise: spent,
    myNet,
    myRole: me?.role ?? "viewer",
    lastActivity: last,
    members: members
      .filter((m) => m.status === "active")
      .map((m) => ({ id: m.userId, name: m.name, email: m.email, image: m.image })),
  };
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Dashboard> => {
    const sql = await getSql();
    const me = await loadUser(context.userId);
    const memberships = await sql<{ book_id: string; role: string }>`
      select book_id, role from members
      where user_id = ${context.userId} and status = 'active'
    `;
    if (memberships.length === 0) {
      return {
        me,
        books: [],
        pulse: {
          coveredThisMonth: 0,
          netBalance: 0,
          pendingApprovals: 0,
          upcomingReminders: 0,
          booksOverBudget: 0,
        },
      };
    }
    const bookIds = memberships.map((m) => m.book_id);
    const bookRows = await sql<BookRow>`
      select * from books where id = any(${bookIds}::text[])
      order by created_at desc
    `;
    const allMembers = await sql<MemberRow>`
      select * from members where book_id = any(${bookIds}::text[])
    `;
    const allUsers = await loadUsers(allMembers.map((m) => m.user_id));
    const membersByBook = new Map<string, Member[]>();
    for (const r of allMembers) {
      const u = allUsers.get(r.user_id);
      const list = membersByBook.get(r.book_id) ?? [];
      list.push({
        id: r.id,
        userId: r.user_id,
        name: u?.name ?? "Member",
        email: u?.email ?? null,
        image: u?.image ?? null,
        role: r.role as MemberRole,
        status: r.status as Member["status"],
        joinedAt: iso(r.joined_at),
      });
      membersByBook.set(r.book_id, list);
    }
    const expenseRows = await sql<ExpenseRow>`
      select e.*,
        exists(select 1 from receipts r where r.expense_id = e.id) as has_receipt
      from expenses e
      where e.book_id = any(${bookIds}::text[])
      order by e.spent_at desc, e.created_at desc
    `;
    const shareRows =
      expenseRows.length === 0
        ? []
        : await sql<{
            expense_id: string;
            user_id: string;
            share_paise: number;
            included: boolean;
          }>`
            select expense_id, user_id, share_paise, included
            from expense_shares
            where expense_id = any(${expenseRows.map((e) => e.id)}::text[])
          `;
    const sharesByExp = new Map<string, Expense["shares"]>();
    for (const s of shareRows) {
      const list = sharesByExp.get(s.expense_id) ?? [];
      list.push({
        userId: s.user_id,
        sharePaise: Number(s.share_paise),
        included: asBool(s.included),
      });
      sharesByExp.set(s.expense_id, list);
    }
    const expensesByBook = new Map<string, Expense[]>();
    for (const r of expenseRows) {
      const list = expensesByBook.get(r.book_id) ?? [];
      list.push(mapExpense(r, sharesByExp.get(r.id) ?? []));
      expensesByBook.set(r.book_id, list);
    }
    const settleRows = await sql<{
      id: string;
      book_id: string;
      from_user: string;
      to_user: string;
      amount_paise: number;
      method: string | null;
      note: string | null;
      created_at: string;
    }>`
      select * from settlements where book_id = any(${bookIds}::text[])
    `;
    const settleByBook = new Map<string, Settlement[]>();
    for (const r of settleRows) {
      const list = settleByBook.get(r.book_id) ?? [];
      list.push({
        id: r.id,
        fromUser: r.from_user,
        toUser: r.to_user,
        amountPaise: Number(r.amount_paise),
        method: r.method,
        note: r.note,
        createdAt: iso(r.created_at),
      });
      settleByBook.set(r.book_id, list);
    }

    const books: BookSummary[] = [];
    for (const b of bookRows) {
      books.push(
        await toSummary(
          b,
          membersByBook.get(b.id) ?? [],
          expensesByBook.get(b.id) ?? [],
          context.userId,
          settleByBook.get(b.id) ?? [],
        ),
      );
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthIso = monthStart.toISOString().slice(0, 10);

    let coveredThisMonth = 0;
    let netBalance = 0;
    let booksOverBudget = 0;
    for (const b of books) {
      netBalance += b.myNet;
      if (b.budgetPaise != null && b.spentPaise > b.budgetPaise) booksOverBudget += 1;
      const exps = expensesByBook.get(b.id) ?? [];
      for (const e of exps) {
        if (e.paidBy === context.userId && e.spentAt >= monthIso) {
          coveredThisMonth += e.amountPaise;
        }
      }
    }

    const pendingApprovals = await sql<{ n: number }>`
      select count(*)::int as n from expenses e
      join members m on m.book_id = e.book_id
      where m.user_id = ${context.userId} and m.status = 'active'
        and m.role in ('owner','approver')
        and e.approval_status = 'pending'
    `;
    const upcoming = await sql<{ n: number }>`
      select count(*)::int as n from reminders r
      join members m on m.book_id = r.book_id
      where m.user_id = ${context.userId} and m.status = 'active'
        and r.done = false and r.due_at >= now()
    `;

    return {
      me,
      books,
      pulse: {
        coveredThisMonth,
        netBalance,
        pendingApprovals: Number(pendingApprovals[0]?.n ?? 0),
        upcomingReminders: Number(upcoming[0]?.n ?? 0),
        booksOverBudget,
      },
    };
  });

export const createBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      title: string;
      cashflow: Cashflow;
      coverTone: CoverTone;
      currency: string;
      budgetPaise: number | null;
      description: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    if (!CASHFLOWS.includes(data.cashflow)) throw new Error("Invalid cashflow");
    if (!COVER_TONES.includes(data.coverTone)) throw new Error("Invalid cover");
    const title = data.title.trim();
    if (title.length < 2) throw new Error("Give the book a name.");
    const sql = await getSql();
    const id = nid("book");
    let code = inviteCode();
    for (let i = 0; i < 6; i++) {
      const clash = await sql<{ id: string }>`select id from books where invite_code = ${code}`;
      if (clash.length === 0) break;
      code = inviteCode();
    }
    await sql`
      insert into books (id, creator_id, title, kind, cashflow, cover_tone, currency, budget_paise, description, invite_code)
      values (
        ${id}, ${context.userId}, ${title}, ${"book"}, ${data.cashflow},
        ${data.coverTone}, ${data.currency || "INR"}, ${data.budgetPaise},
        ${data.description.trim() || null}, ${code}
      )
    `;
    await sql`
      insert into members (id, book_id, user_id, role, status)
      values (${nid("mem")}, ${id}, ${context.userId}, 'owner', 'active')
    `;
    const me = await loadUser(context.userId);
    await postSystem(
      id,
      `${me.name} opened this book. Invite code ${code}.`,
    );
    return { id };
  });

export const joinBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string }) => d)
  .handler(async ({ context, data }) => {
    const code = data.code.trim().toUpperCase();
    if (code.length < 4) throw new Error("Enter an invite code.");
    const sql = await getSql();
    const books = await sql<BookRow>`select * from books where invite_code = ${code}`;
    const book = books[0];
    if (!book) throw new Error("That code does not match a book.");
    if (book.status !== "open") throw new Error("This book is closed.");
    const existing = await sql<MemberRow>`
      select * from members where book_id = ${book.id} and user_id = ${context.userId}
    `;
    if (existing[0]?.status === "active") return { id: book.id };
    if (existing[0]) {
      await sql`
        update members set status = 'active', role = 'contributor', left_at = null, joined_at = now()
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into members (id, book_id, user_id, role, status)
        values (${nid("mem")}, ${book.id}, ${context.userId}, 'contributor', 'active')
      `;
    }
    const me = await loadUser(context.userId);
    await postSystem(book.id, `${me.name} joined the book.`);
    return { id: book.id };
  });

export const getBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string }) => d)
  .handler(async ({ context, data }): Promise<BookDetail> => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    const members = await loadMembers(data.bookId);
    const expenses = await loadExpenses(data.bookId);
    const settlements = await loadSettlements(data.bookId);
    const reminders = await loadReminders(data.bookId);
    const sql = await getSql();
    const bookRow = (
      await sql<BookRow>`select * from books where id = ${data.bookId}`
    )[0];
    const summary = await toSummary(bookRow, members, expenses, context.userId, settlements);
    const balances = computeBalances(members, expenses, settlements);
    const transfers = simplifyDebts(
      balances.map((b) => ({ userId: b.userId, net: b.net })),
    );
    const pot = book.cashflow === "pot" ? await loadPot(data.bookId, expenses) : null;
    return {
      book: summary,
      members,
      expenses,
      balances,
      transfers,
      pot,
      reminders,
      settlements,
      me: { userId: context.userId, role: member.role },
    };
  });

async function loadReminders(bookId: string): Promise<Reminder[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    book_id: string;
    created_by: string;
    title: string;
    due_at: string;
    assigned_to: string | null;
    done: boolean;
    created_at: string;
  }>`
    select * from reminders where book_id = ${bookId} order by done, due_at
  `;
  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    createdBy: r.created_by,
    title: r.title,
    dueAt: iso(r.due_at),
    assignedTo: r.assigned_to,
    done: asBool(r.done),
    createdAt: iso(r.created_at),
  }));
}

export const addExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      bookId: string;
      title: string;
      amountPaise: number;
      category: string;
      note: string;
      spentAt: string;
      paidBy: string;
      includedUserIds: string[];
      isTreat: boolean;
      isPersonal: boolean;
      receipt: { mime: string; dataB64: string } | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (!canWrite(member.role, book.status)) {
      throw new Error("This book is read-only.");
    }
    const title = data.title.trim();
    if (!title) throw new Error("What was this for?");
    if (!Number.isFinite(data.amountPaise) || data.amountPaise <= 0) {
      throw new Error("Enter an amount.");
    }
    if (data.amountPaise > 200_000_000) throw new Error("Amount is too large.");
    const included = [...new Set(data.includedUserIds)];
    if (!data.isTreat && !data.isPersonal && included.length === 0) {
      throw new Error("Pick who was there.");
    }
    const members = await loadMembers(data.bookId);
    const activeIds = new Set(members.filter((m) => m.status === "active").map((m) => m.userId));
    if (!activeIds.has(data.paidBy)) throw new Error("Payer must be in the book.");
    const present = data.isPersonal
      ? [data.paidBy]
      : data.isTreat
        ? included.length
          ? included.filter((id) => activeIds.has(id))
          : [data.paidBy]
        : included.filter((id) => activeIds.has(id));
    if (present.length === 0) throw new Error("Pick who was there.");

    const approval: ApprovalStatus =
      book.kind === "office" && !isOwnerish(member.role) ? "pending" : "none";
    const shares = data.isTreat || data.isPersonal
      ? present.map((id) => ({ userId: id, share: 0 }))
      : splitEqual(data.amountPaise, present.length).map((share, i) => ({
          userId: present[i],
          share,
        }));

    const sql = await getSql();
    const id = nid("exp");
    await sql`
      insert into expenses (
        id, book_id, created_by, paid_by, title, amount_paise, category, note,
        spent_at, split_mode, is_personal, is_treat, approval_status
      ) values (
        ${id}, ${data.bookId}, ${context.userId}, ${data.paidBy}, ${title},
        ${data.amountPaise}, ${data.category || "other"}, ${data.note.trim() || null},
        ${data.spentAt}, ${data.isTreat ? "treat" : data.isPersonal ? "personal" : "equal"},
        ${data.isPersonal}, ${data.isTreat}, ${approval}
      )
    `;
    for (const s of shares) {
      await sql`
        insert into expense_shares (id, expense_id, user_id, share_paise, included)
        values (${nid("shr")}, ${id}, ${s.userId}, ${s.share}, true)
      `;
    }
    if (data.receipt?.dataB64) {
      if (data.receipt.dataB64.length > 280_000) {
        throw new Error("Receipt is too large. Try a closer photo.");
      }
      const mime = data.receipt.mime.startsWith("image/") ? data.receipt.mime : "image/jpeg";
      await sql`
        insert into receipts (id, expense_id, mime, data_b64)
        values (${nid("rcp")}, ${id}, ${mime}, ${data.receipt.dataB64})
      `;
    }
    const me = await loadUser(context.userId);
    const tag = data.isTreat ? "treated everyone to" : data.isPersonal ? "logged a personal" : "logged";
    await postSystem(
      data.bookId,
      `${me.name} ${tag} ${title}.`,
      id,
    );
    return { id };
  });

export const getReceipt = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { expenseId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const exp = await sql<{ book_id: string }>`
      select book_id from expenses where id = ${data.expenseId}
    `;
    if (!exp[0]) throw new Error("Expense not found.");
    await requireMember(context.userId, exp[0].book_id);
    const rec = await sql<{ mime: string; data_b64: string }>`
      select mime, data_b64 from receipts where expense_id = ${data.expenseId}
    `;
    if (!rec[0]) return null;
    return { mime: rec[0].mime, dataB64: rec[0].data_b64 };
  });

export const setExpenseApproval = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { expenseId: string; status: ApprovalStatus }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const exp = await sql<{ book_id: string; title: string }>`
      select book_id, title from expenses where id = ${data.expenseId}
    `;
    if (!exp[0]) throw new Error("Expense not found.");
    const { member } = await requireMember(context.userId, exp[0].book_id);
    if (!isOwnerish(member.role)) throw new Error("Only an approver can do that.");
    if (!["approved", "reimbursed", "pending"].includes(data.status)) {
      throw new Error("Invalid status");
    }
    await sql`
      update expenses set approval_status = ${data.status} where id = ${data.expenseId}
    `;
    const me = await loadUser(context.userId);
    await postSystem(
      exp[0].book_id,
      `${me.name} marked ${exp[0].title} as ${data.status}.`,
    );
    return { ok: true };
  });

export const addPotEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string; amountPaise: number; note: string }) => d)
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (!canWrite(member.role, book.status)) throw new Error("This book is read-only.");
    if (book.cashflow !== "pot") throw new Error("This book does not use a pot.");
    if (data.amountPaise <= 0) throw new Error("Enter an amount.");
    const sql = await getSql();
    await sql`
      insert into pot_entries (id, book_id, user_id, amount_paise, note)
      values (${nid("pot")}, ${data.bookId}, ${context.userId}, ${data.amountPaise}, ${data.note.trim() || null})
    `;
    const me = await loadUser(context.userId);
    await postSystem(data.bookId, `${me.name} added to the pot.`);
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string; body: string; kind?: "chat" | "poll" }) => d)
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (member.role === "viewer") throw new Error("Viewers cannot chat.");
    if (book.status === "archived") throw new Error("This book is archived.");
    const body = data.body.trim();
    if (!body) throw new Error("Write something first.");
    if (body.length > 2000) throw new Error("Message is too long.");
    const sql = await getSql();
    const id = nid("msg");
    await sql`
      insert into messages (id, book_id, user_id, kind, body)
      values (${id}, ${data.bookId}, ${context.userId}, ${data.kind ?? "chat"}, ${body})
    `;
    return { id };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string }) => d)
  .handler(async ({ context, data }): Promise<ChatMessage[]> => {
    await requireMember(context.userId, data.bookId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      book_id: string;
      user_id: string | null;
      kind: string;
      body: string;
      expense_id: string | null;
      created_at: string;
    }>`
      select * from messages where book_id = ${data.bookId} order by created_at asc
    `;
    const users = await loadUsers(rows.map((r) => r.user_id).filter((id): id is string => !!id));
    return rows.map((r) => {
      const u = r.user_id ? users.get(r.user_id) : null;
      return {
        id: r.id,
        bookId: r.book_id,
        userId: r.user_id,
        name: u?.name ?? "Kitaab",
        image: u?.image ?? null,
        kind: r.kind as ChatMessage["kind"],
        body: r.body,
        expenseId: r.expense_id,
        createdAt: iso(r.created_at),
      };
    });
  });

export const votePoll = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { messageId: string; yes: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; book_id: string; kind: string; body: string }>`
      select id, book_id, kind, body from messages where id = ${data.messageId}
    `;
    const msg = rows[0];
    if (!msg || msg.kind !== "poll") throw new Error("Poll not found.");
    await requireMember(context.userId, msg.book_id);
    let parsed: { question: string; estimatePaise: number | null; yes: string[]; no: string[] };
    try {
      parsed = JSON.parse(msg.body) as typeof parsed;
    } catch {
      throw new Error("Broken poll.");
    }
    parsed.yes = parsed.yes.filter((id) => id !== context.userId);
    parsed.no = parsed.no.filter((id) => id !== context.userId);
    if (data.yes) parsed.yes.push(context.userId);
    else parsed.no.push(context.userId);
    await sql`update messages set body = ${JSON.stringify(parsed)} where id = ${msg.id}`;
    return { ok: true };
  });

export const addReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { bookId: string; title: string; dueAt: string; assignedTo: string | null }) => d,
  )
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (!canWrite(member.role, book.status) && member.role !== "viewer") {
      /* viewers still cannot */
    }
    if (member.role === "viewer") throw new Error("Viewers cannot add reminders.");
    const title = data.title.trim();
    if (!title) throw new Error("What should we remember?");
    const sql = await getSql();
    const id = nid("rem");
    await sql`
      insert into reminders (id, book_id, created_by, title, due_at, assigned_to)
      values (${id}, ${data.bookId}, ${context.userId}, ${title}, ${data.dueAt}, ${data.assignedTo})
    `;
    const me = await loadUser(context.userId);
    await postSystem(data.bookId, `${me.name} set a reminder: ${title}.`);
    return { id };
  });

export const toggleReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { reminderId: string; done: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ book_id: string }>`
      select book_id from reminders where id = ${data.reminderId}
    `;
    if (!rows[0]) throw new Error("Reminder not found.");
    await requireMember(context.userId, rows[0].book_id);
    await sql`update reminders set done = ${data.done} where id = ${data.reminderId}`;
    return { ok: true };
  });

export const kickMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string; userId: string }) => d)
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (member.role !== "owner") throw new Error("Only the creator can drop someone.");
    if (data.userId === book.creatorId) throw new Error("The creator cannot be dropped.");
    const sql = await getSql();
    await sql`
      update members set status = 'removed', left_at = now()
      where book_id = ${data.bookId} and user_id = ${data.userId} and status = 'active'
    `;
    const who = await loadUser(data.userId);
    await postSystem(data.bookId, `${who.name} was dropped from the book.`);
    return { ok: true };
  });

export const leaveBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string }) => d)
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (member.role === "owner") {
      throw new Error("Hand the book to someone else, or lock it, before leaving.");
    }
    const sql = await getSql();
    await sql`
      update members set status = 'left', left_at = now()
      where book_id = ${data.bookId} and user_id = ${context.userId}
    `;
    const me = await loadUser(context.userId);
    await postSystem(data.bookId, `${me.name} left the book.`);
    void book;
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string; userId: string; role: MemberRole }) => d)
  .handler(async ({ context, data }) => {
    const { member } = await requireMember(context.userId, data.bookId);
    if (member.role !== "owner") throw new Error("Only the creator can change roles.");
    if (data.userId === context.userId) throw new Error("You are already the owner.");
    if (!["approver", "contributor", "viewer"].includes(data.role)) {
      throw new Error("Invalid role");
    }
    const sql = await getSql();
    await sql`
      update members set role = ${data.role}
      where book_id = ${data.bookId} and user_id = ${data.userId} and status = 'active'
    `;
    return { ok: true };
  });

export const rotateInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string }) => d)
  .handler(async ({ context, data }) => {
    const { member } = await requireMember(context.userId, data.bookId);
    if (member.role !== "owner") throw new Error("Only the creator can rotate the code.");
    const sql = await getSql();
    let code = inviteCode();
    for (let i = 0; i < 6; i++) {
      const clash = await sql<{ id: string }>`select id from books where invite_code = ${code}`;
      if (clash.length === 0) break;
      code = inviteCode();
    }
    await sql`update books set invite_code = ${code} where id = ${data.bookId}`;
    return { inviteCode: code };
  });

export const settleUp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { bookId: string; fromUser: string; toUser: string; amountPaise: number; method: string }) =>
      d,
  )
  .handler(async ({ context, data }) => {
    const { member, book } = await requireMember(context.userId, data.bookId);
    if (!canWrite(member.role, book.status) && member.role !== "owner") {
      throw new Error("This book is read-only.");
    }
    if (data.amountPaise <= 0) throw new Error("Enter an amount.");
    if (data.fromUser === data.toUser) throw new Error("Pick two different people.");
    const sql = await getSql();
    await sql`
      insert into settlements (id, book_id, from_user, to_user, amount_paise, method)
      values (${nid("set")}, ${data.bookId}, ${data.fromUser}, ${data.toUser}, ${data.amountPaise}, ${data.method || "other"})
    `;
    const people = await loadUsers([data.fromUser, data.toUser]);
    await postSystem(
      data.bookId,
      `${people.get(data.fromUser)?.name} settled with ${people.get(data.toUser)?.name}.`,
    );
    return { ok: true };
  });

export const setBookStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { bookId: string; status: BookStatus }) => d)
  .handler(async ({ context, data }) => {
    const { member } = await requireMember(context.userId, data.bookId);
    if (member.role !== "owner") throw new Error("Only the creator can close the book.");
    if (!["open", "locked", "archived"].includes(data.status)) throw new Error("Invalid status");
    const sql = await getSql();
    await sql`update books set status = ${data.status} where id = ${data.bookId}`;
    const me = await loadUser(context.userId);
    const verb =
      data.status === "locked"
        ? "closed the book for the reckoning"
        : data.status === "archived"
          ? "archived the book"
          : "reopened the book";
    await postSystem(data.bookId, `${me.name} ${verb}.`);
    return { ok: true };
  });

export const updateBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: { bookId: string; title?: string; budgetPaise?: number | null; description?: string }) => d,
  )
  .handler(async ({ context, data }) => {
    const { member } = await requireMember(context.userId, data.bookId);
    if (member.role !== "owner") throw new Error("Only the creator can edit the book.");
    const sql = await getSql();
    if (data.title != null) {
      const title = data.title.trim();
      if (title.length < 2) throw new Error("Give the book a name.");
      await sql`update books set title = ${title} where id = ${data.bookId}`;
    }
    if (data.budgetPaise !== undefined) {
      await sql`update books set budget_paise = ${data.budgetPaise} where id = ${data.bookId}`;
    }
    if (data.description !== undefined) {
      await sql`update books set description = ${data.description.trim() || null} where id = ${data.bookId}`;
    }
    return { ok: true };
  });
