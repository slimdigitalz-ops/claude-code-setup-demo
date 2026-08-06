/**
 * The ONLY module that touches storage.
 *
 * Routes never read or write the store directly — they call this repository.
 * Swapping the in-memory Map for Postgres should require changing this file
 * and nothing else.
 */

import type { Cents } from '../lib/money.ts';

export interface Expense {
  id: string;
  description: string;
  amountCents: Cents;
  category: string;
  createdAt: string;
}

export interface NewExpense {
  description: string;
  amountCents: Cents;
  category: string;
}

const store = new Map<string, Expense>();

export function create(input: NewExpense): Expense {
  const expense: Expense = {
    id: crypto.randomUUID(),
    description: input.description,
    amountCents: input.amountCents,
    category: input.category,
    createdAt: new Date().toISOString(),
  };

  store.set(expense.id, expense);
  return expense;
}

export function findById(id: string): Expense | undefined {
  return store.get(id);
}

export function list(category?: string): Expense[] {
  const all = [...store.values()];
  const filtered = category ? all.filter((e) => e.category === category) : all;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function remove(id: string): boolean {
  return store.delete(id);
}

/** Test helper. Never called from application code. */
export function _reset(): void {
  store.clear();
}
