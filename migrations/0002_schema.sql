-- Kitaab shared books, expenses, chat, reminders, receipts.

create table if not exists books (
  id            text primary key,
  creator_id    text not null,
  title         text not null,
  kind          text not null,
  cashflow      text not null,
  cover_tone    text not null,
  currency      text not null default 'INR',
  budget_paise  integer,
  description   text,
  status        text not null default 'open',
  invite_code   text not null unique,
  created_at    timestamptz not null default now()
);
create index if not exists books_creator_id_idx on books (creator_id);
create index if not exists books_invite_code_idx on books (invite_code);

create table if not exists members (
  id         text primary key,
  book_id    text not null references books(id) on delete cascade,
  user_id    text not null,
  role       text not null,
  status     text not null default 'active',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  unique (book_id, user_id)
);
create index if not exists members_user_id_idx on members (user_id);
create index if not exists members_book_id_idx on members (book_id);

create table if not exists expenses (
  id               text primary key,
  book_id          text not null references books(id) on delete cascade,
  created_by       text not null,
  paid_by          text not null,
  title            text not null,
  amount_paise     integer not null,
  category         text not null,
  note             text,
  spent_at         date not null,
  split_mode       text not null,
  is_personal      boolean not null default false,
  is_treat         boolean not null default false,
  approval_status  text not null default 'none',
  created_at       timestamptz not null default now()
);
create index if not exists expenses_book_id_idx on expenses (book_id);
create index if not exists expenses_spent_at_idx on expenses (book_id, spent_at desc);

create table if not exists expense_shares (
  id            text primary key,
  expense_id    text not null references expenses(id) on delete cascade,
  user_id       text not null,
  share_paise   integer not null,
  included      boolean not null default true
);
create index if not exists expense_shares_expense_id_idx on expense_shares (expense_id);

create table if not exists receipts (
  id          text primary key,
  expense_id  text not null unique references expenses(id) on delete cascade,
  mime        text not null,
  data_b64    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists messages (
  id          text primary key,
  book_id     text not null references books(id) on delete cascade,
  user_id     text,
  kind        text not null,
  body        text not null,
  expense_id  text,
  created_at  timestamptz not null default now()
);
create index if not exists messages_book_id_idx on messages (book_id, created_at);

create table if not exists reminders (
  id          text primary key,
  book_id     text not null references books(id) on delete cascade,
  created_by  text not null,
  title       text not null,
  due_at      timestamptz not null,
  assigned_to text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists reminders_book_id_idx on reminders (book_id, due_at);

create table if not exists pot_entries (
  id            text primary key,
  book_id       text not null references books(id) on delete cascade,
  user_id       text not null,
  amount_paise  integer not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists pot_entries_book_id_idx on pot_entries (book_id);

create table if not exists settlements (
  id            text primary key,
  book_id       text not null references books(id) on delete cascade,
  from_user     text not null,
  to_user       text not null,
  amount_paise  integer not null,
  method        text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists settlements_book_id_idx on settlements (book_id);
