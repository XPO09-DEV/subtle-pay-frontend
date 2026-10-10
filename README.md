# Subtle Pay

Payments that feel like a message.

Subtle is a consumer payments product on Monad. A person registers, receives a private account and a custodial wallet, and sends money by name, contact, or merchant QR. The amount is entered in a familiar currency. Settlement happens in MON on Monad testnet.

The consumer application in this repository is for users only. Platform operations live in a separate internal console that is not linked from this app and is not part of the public experience.

---

## What a user can do

- Create an account and receive a 27-character account id
- Set a display name (alias)
- Send money by name, contact, account id, or address
- Authorize a payment with a personal MPIN or device biometric (face or fingerprint)
- Receive via a name or a merchant QR
- View history, set a preferred currency, and withdraw
- Set autopay for a business that Subtle has verified

Supported display currencies are quoted live. Fiat rates come from Frankfurter (ECB). Crypto prices come from CoinGecko. The payment itself settles on Monad.

---

## Architecture

| Surface | Who it is for | How it runs |
|---|---|---|
| This app | Every user | `npm run dev` → port **5173** |
| Internal console | Operators only | Separate process, port **5174**. Not linked here. |
| API | Both, with different access | Backend on port **4000** |

The user app proxies API calls to the backend. It does not proxy, link, or expose the operator console.

---

## Start the user app

Requirements: Node 20 or newer. The backend must already be running on port 4000.

```bash
git clone https://github.com/XPO09-DEV/subtle-pay-frontend.git
cd subtle-pay-frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Leave `VITE_API_URL` empty so the Vite proxy is used.

### First session

1. Register with a password. The app shows the account id. Save it.
2. Open Settings and set a name, an MPIN, and optionally a biometric.
3. Fund the wallet address from the [Monad faucet](https://faucet.monad.xyz).
4. Send to another account by name or address. Confirm with MPIN or biometric.

---

## Operator console

The operator console is not part of this application. It is started separately and is restricted to the local operator network.

```bash
npm run dev:admin
```

That process listens on [http://localhost:5174](http://localhost:5174). It is not linked from the user app. Access credentials and the full control guide are in the backend repository README.

---

## Product notes for review

- Payments require the user’s own MPIN or biometric. Neither is a platform login.
- Autopay can only be created against a business Subtle has verified. Creating a mandate is a customer action. Merchant eligibility does not create a mandate.
- Rates are live. `GET /rates/all` on the API returns the current snapshot.
- A confirmed Monad testnet payment is documented in the backend README.

---

## Repository

Frontend: [github.com/XPO09-DEV/subtle-pay-frontend](https://github.com/XPO09-DEV/subtle-pay-frontend)  
Backend: [github.com/XPO09-DEV/Subtle-Pay-backend](https://github.com/XPO09-DEV/Subtle-Pay-backend)

Do not commit `.env` or `node_modules`.
