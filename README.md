# UrbanRides MVP (Early Stage Startup Version)

A simple end-to-end ride booking app for a **single service area** with rider-entered miles, automatic fare calculation, Slack operations alerts, and a lightweight admin dashboard.

## Product behavior implemented

### Rider booking flow (`/`)
- Pickup and dropoff with address suggestions (no map UI required).
- Rider enters **one-way total miles**.
- System also computes estimated miles from coordinates.
- Backend validates large mismatches (anti-fraud / typo safety).
- Required fields:
  - pickup
  - dropoff
  - date
  - time
  - miles
  - phone
  - email
- Fare formula:
  - `fare = BASE_FARE_USD + (PER_MILE_FARE_USD * riderMiles)`

### Operations flow (Slack + Admin)
- Every new ride request posts to Slack (if `SLACK_WEBHOOK_URL` is configured).
- Admin dashboard at `/admin` lets ops team:
  - review rides,
  - update ride status,
  - set driver name and phone,
  - track edge-case outcomes.
- Statuses include real-world corner cases:
  - `FAILED_PICKUP`
  - `COMMUNICATION_FAILED`
  - `PASSENGER_NO_SHOW`
  - `NO_DRIVER_AVAILABLE`

## Why this fits early startup stage
- No heavy map rendering stack.
- Lightweight channel ops with Slack webhook.
- Manual control via admin dashboard while dispatch process is still human-in-the-loop.
- Clear status audit trail in Firebase for daily ride review.

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Optional region branding on UI/API messages
NEXT_PUBLIC_REGION_NAME=Long Beach

# Slack Incoming Webhook URL (for ride + status alerts)
SLACK_WEBHOOK_URL=

# Protects /api/admin-update-ride
ADMIN_DASHBOARD_KEY=

# Optional Telegram bridge for direct driver chat
TELEGRAM_BOT_TOKEN=
```

## Business rules

Rules are centralized in `lib/rideRules.ts`:
- region center and service radius
- max trip miles
- base fare and per-mile fare
- statuses and labels

## Run

```bash
npm install
npm run dev
```

### Local test links
- Rider app: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`

## Recommended pre-production checks
- Add rate limiting for all public APIs.
- Add phone/email verification.
- Add auth for admin UI page itself (not just API key).
- Add dead-letter handling for Slack/Telegram failures.
- Add reconciliation job to flag rides stuck in `PENDING` too long.


## If booking still shows "Internal Server Error" on Vercel

Check these first in your Vercel Project → Settings → Environment Variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional but recommended:
- `SLACK_WEBHOOK_URL` (if invalid, booking now still succeeds, but Slack alert may fail)
- `NEXT_PUBLIC_REGION_NAME`
- `ADMIN_DASHBOARD_KEY`
- `TELEGRAM_BOT_TOKEN`

After editing env vars in Vercel, redeploy once so the server picks them up.
