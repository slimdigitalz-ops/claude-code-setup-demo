import express, { type NextFunction, type Request, type Response } from 'express';
import { expenses } from './routes/expenses.ts';
import { ApiError } from './lib/errors.ts';

export const app = express();

app.use(express.json());
app.use('/expenses', expenses);

app.use((_req, res) => {
  res.status(404).json(ApiError.notFound('Route not found').toJSON());
});

/**
 * The only place in the app that writes an error response.
 * Unknown errors are logged in full and reported to the client as `internal`.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json(new ApiError('internal', 'Something went wrong').toJSON());
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`ledger-api listening on :${port}`));
}
