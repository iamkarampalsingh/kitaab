export function rupeesToPaise(value: number) {
  return Math.round(value * 100);
}

export function paiseToRupees(paise: number) {
  return paise / 100;
}

export function formatMoney(paise: number, currency = "INR") {
  const abs = Math.abs(paise);
  const fraction = abs % 100 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(paise / 100);
  } catch {
    return `${currency} ${(paise / 100).toFixed(fraction)}`;
  }
}

export function splitEqual(totalPaise: number, n: number) {
  if (n <= 0) return [];
  const base = Math.floor(totalPaise / n);
  const rem = totalPaise % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export type NetRow = { userId: string; net: number };

export type Transfer = { from: string; to: string; amount: number };

/** net > 0 means the group owes this person. */
export function simplifyDebts(nets: NetRow[]): Transfer[] {
  const debtors = nets
    .filter((n) => n.net < -1)
    .map((n) => ({ userId: n.userId, rest: -n.net }))
    .sort((a, b) => b.rest - a.rest);
  const creditors = nets
    .filter((n) => n.net > 1)
    .map((n) => ({ userId: n.userId, rest: n.net }))
    .sort((a, b) => b.rest - a.rest);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].rest, creditors[j].rest);
    if (pay > 0) {
      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: pay,
      });
      debtors[i].rest -= pay;
      creditors[j].rest -= pay;
    }
    if (debtors[i].rest <= 1) i += 1;
    if (creditors[j].rest <= 1) j += 1;
  }
  return transfers;
}

export function signedMoney(paise: number, currency = "INR") {
  if (paise === 0) return formatMoney(0, currency);
  const formatted = formatMoney(Math.abs(paise), currency);
  return paise > 0 ? `+${formatted}` : `−${formatted}`;
}
