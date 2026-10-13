# Subtle Pay Frontend Integration Reconnaissance (Step 1)

Scope inspected: `XPO09-DEV/subtle-pay-frontend` at the integration branch base. This report describes current source wiring and is not a live end-to-end pass.

## Architecture and entry points

- React 19 + TypeScript + Vite; `npm run build` runs TypeScript project build plus Vite; `npm run lint` runs oxlint.
- Active shell: `src/App.tsx`. It uses the in-memory access-token / refresh-cookie `src/services/accountService.ts`, restores the backend session at startup, loads `GET /home` via the wallet service, and mounts Wallet/Dashboard, Send, Receive, Activity, Notifications, Merchant and More through local page state.
- A second legacy API/auth implementation remains in `src/api/client.ts` plus `src/hooks/useAuth.ts`; it stores access and refresh tokens in localStorage and expects JSON refresh tokens. That expectation does not match the current backend route’s HttpOnly-cookie refresh response. It is also consumed by older React Router pages, including History and Withdraw, not mounted by the active App shell.
- Environment variables in `.env.example`: `VITE_SUBTLEPAY_API_BASE_URL` and `VITE_SUBTLEPAY_WALLET_ASSETS_PATH`. No provider credential should be exposed under `VITE_*`.

## Page/component map

- Active shell pages: Dashboard, Send, Receive, Activity, Notifications, Merchant, More/Settings.
- Additional/legacy pages: Home, Login, Register, History, Withdraw, Settings.
- Key wallet/UI components: WalletCard, BalanceCard, TokenAssetsWidget, TransactionItem, BottomNav, Button, Input, CurrencyPicker, CurrencyPreference, Icon, AccountGate.
- QR components: QRCodeCard, QRCodeModal (qrcode.react), QRScanner (jsQR camera + image-upload fallback); payload helpers are in `src/utils/qr.ts`.
- Data/services: `src/services/accountService.ts`, `src/services/walletService.ts`, legacy `src/api/client.ts`, `src/types/api.ts`, `src/data/currencies.ts`, legacy `src/data/walletData.ts`, `src/utils/currencies.ts`, `src/utils/format.ts`.

## API wiring

- Active account service calls: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `PUT /me/profile`, `GET /home`, `POST /payments/send`, `GET /payments`, `GET /rates?currency=USD|INR`.
- Wallet asset listing calls backend `GET /api/wallet/assets?address=…` and can request `refresh=true`.
- TokenAssetsWidget's market/search/chart requests use the backend’s CoinGecko-compatible routes (`/search`, `/coins/markets`, `/coins/:id`, `/coins/:id/market_chart`); the backend proxies provider traffic. Frontend code has no provider keys.
- The older API client calls profile, alias, rates, assets, contacts not currently represented in its API map, send/history, and withdrawals; this older pattern is not a coherent fit for the active account-service session contract.

## Verified gaps / risks from source inspection

1. `Dashboard.tsx` keeps saved contacts in browser localStorage even though authenticated `/contacts` CRUD exists in the backend.
2. `CurrencyPreference.tsx` persists default currency only in localStorage; the backend already supports user currency via `GET /me` and `PUT /me/currency`.
3. `Receive.tsx` shows/copies/shares the account address but does not mount the QR modal. QR UI exists but is unused by the active shell; the Send page does mount QRScanner and validates scanned network IDs as a notice.
4. `Merchant.tsx` explicitly states that form submissions are not sent. Withdrawal is disabled by the backend, while the legacy Withdraw page still tries to submit.
5. More/settings contains placeholder actions for account switching, biometric access, sessions, merchant verification and privacy features not backed by corresponding endpoints.
6. `src/api/client.ts` stores a refresh token in localStorage and is incompatible with the backend HttpOnly-cookie rotation contract. Although it appears unused by the active app shell, legacy pages still import it; it should be retired or aligned before those pages are mounted.
7. App resume consent, selected token, wallet display name migration and contacts are local/browser state. Resume state is consent-gated; display-name changes are sent to backend, but saved contacts and currency are not.
8. The main dashboard gets the native Monad Testnet MON balance from authenticated backend `/home`; indexed token holdings come through the backend provider endpoint. Only native MON is payable in this hackathon branch.
9. QR payload uses a custom `subtlepay://pay` format and contains recipient/address/chain but no amount. The scan flow pre-fills the recipient and does not auto-submit a payment; QR generation should be reachable from Receive.
10. The frontend CI workflow runs `npm ci`, `npm run build` and `npm run lint`. Camera permission, actual QR scan, login in a forwarded browser, and testnet settlement require runtime verification.

## Verification boundary

No client-side key material is required. No live backend or camera session was available during source inspection. A real testnet transaction must be performed with newly generated testnet accounts/wallets to claim end-to-end success.
