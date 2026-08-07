import { app } from './app.ts';

/**
 * Bootstrap only. Everything about the app itself is in `app.ts`, which has no
 * side effects on import — that's what keeps `npm test` from hanging on an open
 * socket.
 */
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => console.log(`ledger-api listening on :${port}`));
