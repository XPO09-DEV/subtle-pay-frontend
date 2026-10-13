# Frontend/backend integration

This UI connects to the Subtle Pay Fastify API; it must not connect to a chain RPC or invent balances locally.

## Run locally

- Use Node.js 22 or newer and install frontend dependencies with `npm ci`.
- Set `VITE_SUBTLEPAY_API_BASE_URL=http://localhost:4000` in an untracked local `.env` (see `.env.example`).
- Start the API first from `Subtle-Pay-backend` with its own `.env`, then run `npm run dev` in this repository.
- The API must allow the exact Vite origin in `CORS_ORIGINS` and credentialed cookies. In production use HTTPS and a matching same-site/reverse-proxy setup.

## Integration contracts

`accountService.ts` is the typed request layer for account/home, wallet, payments, contacts, currency, profile, and signed QR operations. `walletService.ts` displays only backend-returned native MON on Monad Testnet (chain ID `10143`). The in-memory access token is not persisted; the backend owns refresh-token state in an HttpOnly cookie. Do not add secrets to `VITE_*` variables.

The Receive QR is generated/signed by `GET /qr/pay`. Send verifies any signed Subtle Pay QR with `POST /qr/verify` before using a supplied amount/currency. Address-only QRs may fill only the recipient address. Camera access requires HTTPS or `localhost`, plus a user action to grant permission.

Only free faucet MON is enabled for settlement in this hackathon build. Do not point this frontend at mainnet, add direct wallet/RPC transaction calls, or display mocked/fixed balances as backend truth.
