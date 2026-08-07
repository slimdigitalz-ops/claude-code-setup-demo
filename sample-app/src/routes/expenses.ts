import { Router } from 'express';
import * as repo from '../db/expenseRepository.ts';
import { ApiError } from '../lib/errors.ts';
import { formatAmount, parseAmount, sum } from '../lib/money.ts';

export const expenses = Router();

/** Serialize for the wire. Amounts go out as formatted strings, never floats. */
function present(expense: repo.Expense) {
  return {
    id: expense.id,
    description: expense.description,
    amount: formatAmount(expense.amountCents),
    category: expense.category,
    createdAt: expense.createdAt,
  };
}

expenses.get('/', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const found = repo.list(category);

  res.json({
    expenses: found.map(present),
    total: formatAmount(sum(found.map((e) => e.amountCents))),
  });
});

expenses.get('/:id', (req, res) => {
  const expense = repo.findById(req.params.id);
  if (!expense) {
    throw ApiError.notFound(`No expense with id ${req.params.id}`);
  }
  res.json(present(expense));
});

expenses.post('/', (req, res) => {
  const { description, amount, category } = req.body ?? {};

  if (typeof description !== 'string' || description.trim() === '') {
    throw ApiError.badRequest('description is required');
  }
  if (typeof category !== 'string' || category.trim() === '') {
    throw ApiError.badRequest('category is required');
  }
  if (typeof amount !== 'string') {
    throw ApiError.badRequest('amount is required and must be a string like "12.30"');
  }

  let amountCents: number;
  try {
    amountCents = parseAmount(amount);
  } catch {
    throw ApiError.badRequest(`amount is not a valid money value: ${amount}`);
  }

  // Both are trimmed: `list()` filters by exact category match, so a stored
  // " food " would be unreachable via ?category=food.
  const created = repo.create({
    description: description.trim(),
    amountCents,
    category: category.trim(),
  });
  res.status(201).json(present(created));
});

expenses.delete('/:id', (req, res) => {
  if (!repo.remove(req.params.id)) {
    throw ApiError.notFound(`No expense with id ${req.params.id}`);
  }
  res.status(204).end();
});
