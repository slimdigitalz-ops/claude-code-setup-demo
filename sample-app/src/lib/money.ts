/**
 * Money is ALWAYS integer cents inside this codebase.
 *
 * Floats are never used for currency. `12.30` cannot be represented exactly in
 * binary floating point, and summing enough of them drifts. Every amount that
 * crosses a boundary — HTTP, database, logs — is an integer number of cents.
 */

export type Cents = number;

/** Parse a user-supplied amount string ("12.30") into integer cents. */
export function parseAmount(input: string): Cents {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new RangeError(`Not a valid amount: ${input}`);
  }

  // Deliberately not `split('.')` destructuring: under `noUncheckedIndexedAccess`
  // that yields `string | undefined`, and silencing it with `!` would violate the
  // rule in CLAUDE.md. Slicing keeps both halves definitely `string`.
  const dot = trimmed.indexOf('.');
  const whole = dot === -1 ? trimmed : trimmed.slice(0, dot);
  const fraction = dot === -1 ? '' : trimmed.slice(dot + 1);

  const sign = whole.startsWith('-') ? -1 : 1;
  const wholeCents = Math.abs(Number(whole)) * 100;
  const fractionCents = Number(fraction.padEnd(2, '0'));
  const total = sign * (wholeCents + fractionCents);

  // The regex allows unlimited digits. Past MAX_SAFE_INTEGER the arithmetic above
  // silently returns a wrong number, which is the exact failure this module exists
  // to prevent. Refuse instead.
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`Amount is too large to represent exactly: ${input}`);
  }

  return total;
}

/** Format integer cents for display ("1230" -> "12.30"). */
export function formatAmount(cents: Cents): string {
  // `Cents` is a type alias, not a guarantee. A float reaching here would produce
  // "0.12.5" rather than failing, so check at the boundary.
  if (!Number.isInteger(cents)) {
    throw new RangeError(`Amount must be whole cents, got: ${cents}`);
  }

  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function sum(amounts: readonly Cents[]): Cents {
  return amounts.reduce((total, amount) => total + amount, 0);
}
