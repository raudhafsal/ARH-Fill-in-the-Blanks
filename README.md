# ARH Fill in the Blank POS

A Progressive Web App Point of Sale and business-management system for **ARH Fill in the Blank**, a takeaway food & beverage business in the Maldives (currency: **MVR**).

Built with Next.js (App Router) + TypeScript + Tailwind CSS + shadcn-style UI + Supabase (Postgres, Auth, Storage, RLS, Realtime). No separate backend server — everything runs through `GitHub → Vercel → Supabase`.

This is an **internal POS / business management system**. It intentionally does **not** include an online shop, public product catalogue, customer checkout website, delivery marketplace, or public registration.

---

## 0. Your live Supabase backend

A Supabase project has already been created and fully provisioned for this app:

- **Project name**: `arh-fill-in-the-blank-pos`
- **Project ref**: `fercnahcnikdnvbusnuv`
- **Region**: `ap-south-1` (Mumbai — closest available region to the Maldives)
- **URL**: `https://fercnahcnikdnvbusnuv.supabase.co`
- Schema, RLS policies, functions/RPCs, triggers, and storage buckets from `supabase/migrations/001_initial_schema.sql` are applied, plus an additional security/performance hardening pass (`003_security_performance_hardening.sql` — tightens RPC execute grants so only signed-in staff can call them, and optimizes RLS policies for query performance).
- Catalog was left **empty** (no demo data) — add your real categories and products from Settings/Products once you sign in.
- `.env.local` in this project is already filled in with this project's URL and anon key — you can run `npm install && npm run dev` immediately.
- **You still need to create your first administrator account** — see section 8 below (Supabase Dashboard → Authentication → Users → Add user). Nothing else works until that account exists.
- When you deploy to Vercel, use the same `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` values from `.env.local` as your Vercel environment variables (see section 7).

Sections 4 and 6 below describe how this was set up in case you ever need to recreate it or set up a second (e.g. staging) project.

---

## 1. What's included

- Email/password staff login (Supabase Auth), no public sign-up. Roles: **Administrator**, **Manager**, **Cashier**, enforced by both the UI and PostgreSQL Row Level Security (RLS) — the database is the real gatekeeper, not the frontend.
- Responsive app shell: sidebar on desktop, bottom nav + "More" menu on mobile, light/dark/system theme.
- **Dashboard**: today/week/month stats, low & out-of-stock counts, charts (sales & orders by day, sales by category, payment method breakdown), recent orders.
- **POS**: category + product grid, cart with per-item and whole-order discounts (role-capped), order notes, Takeaway/Pickup/(optional Dine-in), barcode scanning (USB/Bluetooth keyboard-wedge scanners + optional camera scanning where supported), held/parked orders, keyboard shortcuts (F2/F4/F6/F8/Esc/Ctrl+K), cash/card/bank/mobile/other payments with automatic change calculation, printable receipts (58mm / 80mm / A4).
- **Cash register**: open with a float, cash in/out, close with an expected-vs-actual reconciliation and confirmation step.
- **Orders / Sales history**: filterable list, order detail, reprint, void, and a controlled refund flow (never deletes the original sale — always a linked refund record with inventory put back).
- **Products, Categories, Inventory, Stock adjustments, Purchases, Suppliers** with full CRUD and a complete inventory transaction ledger (every stock change is recorded, nothing is silently overwritten).
- **Expenses, Customers, Reports** (sales, product, category, payment, expense, inventory, profit-estimate — all with CSV export), **Staff performance report**, **Kitchen/preparation screen** (optional, togglable), **Settings** (business, tax, payment methods, discount limits, staff roles, printer/receipt).
- **PWA**: installable on iPhone/Android/desktop, manifest + icons + service worker, offline detection, and an offline-safe sale queue — sales made while offline are queued locally with a unique client transaction ID and synced automatically when the connection returns. The database enforces uniqueness on that ID, so a retried sync can never create a duplicate sale.
- Full **audit log** of sensitive actions (sales, refunds, voids, stock changes, price changes, settings changes, etc.), automatically recorded by the database functions — nothing relies on the frontend to log correctly.

## 2. Tech stack

Next.js 14 (App Router) · TypeScript (strict) · React 18 · Tailwind CSS · Radix UI primitives (shadcn-style, hand-included — no external registry dependency) · Supabase (Postgres + Auth + Storage + RLS + Realtime) · Zod validation · Recharts · next-pwa.

## 3. Project structure

```
app/
  (auth)/          Login, forgot/reset password (public routes)
  (app)/            Everything behind login, wrapped in the app shell
    dashboard/ pos/ register/ orders/ products/ categories/ inventory/
    purchases/ suppliers/ expenses/ customers/ reports/ staff/ settings/
    kitchen/ profile/
components/
  ui/              Base UI primitives (button, input, dialog, table, ...)
  app-shell/       Sidebar, header, mobile nav, theme, offline indicator
  shared/          Reusable page pieces (empty state, stat card, confirm dialog, ...)
  pos/             POS-specific UI
lib/
  supabase/        Browser / server / middleware Supabase clients (anon key only)
  pos/             Cart math, offline sale queue, held orders, barcode/keyboard hooks
  auth.ts          requireProfile() / requireRole() server helpers
  nav-config.ts    Role-based navigation
  utils.ts         Currency + Maldives-timezone formatting, client txn IDs
types/database.ts Hand-written TypeScript types matching the SQL schema
supabase/migrations/
  001_initial_schema.sql   Full schema, RLS policies, functions/RPCs, triggers, storage buckets
  002_demo_seed.sql        Optional demo categories/products (clearly marked "(Demo)")
public/            PWA manifest, icons (placeholder "ARH" logo — replace with the real one)
```

## 4. Supabase setup

1. Create a project at [supabase.com](https://supabase.com/dashboard) (choose a region close to the Maldives, e.g. Singapore).
2. Open the SQL Editor and run **`supabase/migrations/001_initial_schema.sql`** in full. This creates every table, index, constraint, function/RPC, trigger, RLS policy, and the storage buckets (`product-images`, `business-assets`, `expense-receipts`, `avatars`) with their policies.
3. Optionally run **`supabase/migrations/002_demo_seed.sql`** to add demo categories/products for exploring the app (safe to skip — all demo rows are prefixed `(Demo)`).
4. **Auth settings** (Authentication → URL Configuration): set the Site URL to your Vercel production URL, and add it (plus `http://localhost:3000` for local dev) to the Redirect URLs list — this is required for the "forgot password" email link to work.
5. **Storage**: nothing else to configure — the buckets and their RLS-style storage policies were created by the migration.
6. **Create your first administrator**: Authentication → Users → *Add user* (email + password, tick "Auto Confirm"). Open the new user, edit **Raw user meta data** to:
   ```json
   { "full_name": "Your Name", "role": "administrator" }
   ```
   A database trigger automatically creates the matching `profiles` row with that role the moment the user is created. Sign in with that account — you now have full access, including Settings, where you can review/adjust everyone else's role later.
7. Create additional staff (managers/cashiers) the same way, using `"role": "manager"` or `"role": "cashier"` (or leave `role` out — it defaults to cashier). There is deliberately **no public registration** and no in-app account creation, because that would require exposing the Supabase service-role key to the browser, which this app never does.

## 5. Local development

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# (Project Settings → API in the Supabase dashboard)
npm run dev
```

Open http://localhost:3000 and sign in with the administrator account you created above.

Useful scripts: `npm run build`, `npm run typecheck` (`tsc --noEmit`), `npm run lint`.

## 6. Environment variables

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public, safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Public/anon key **only** — RLS protects the data. Never use the service-role key here. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL (or `http://localhost:3000` locally) | Used to build the password-reset redirect link |

`.env.local` is git-ignored — never commit real credentials. `.env.example` documents the shape only.

## 7. GitHub → Vercel deployment

1. **Create a Supabase project and run the migration** (see section 4 above).
2. **Push this project to a new GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ARH Fill in the Blank POS"
   git branch -M main
   git remote add origin https://github.com/<your-org>/<your-repo>.git
   git push -u origin main
   ```
3. **Import the repository into Vercel** (vercel.com → Add New → Project → import from GitHub). Framework preset: Next.js (auto-detected).
4. **Add environment variables** in Vercel (Project Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` (set this to your production Vercel URL, e.g. `https://arh-pos.vercel.app`).
5. **Deploy.**
6. **Configure the production URL in Supabase Auth** (Authentication → URL Configuration): set Site URL and add the Vercel URL to Redirect URLs, exactly as in local setup — otherwise password-reset links will point at the wrong place.
7. Open the deployed URL, sign in with your administrator account, and you're live. Install it on a phone via the browser's "Add to Home Screen" / "Install app" prompt (Chrome/Edge on Android, Safari's Share → Add to Home Screen on iPhone).

No separate backend, no Firebase, nothing else to host.

## 8. Default administrator setup (quick reference)

Supabase Dashboard → Authentication → Users → Add user → tick "Auto Confirm User" → after creating, edit the user and set **Raw user meta data** to `{"full_name": "Admin Name", "role": "administrator"}` → sign in at `/login` with that email/password.

## 9. POS user guide (cashier quick start)

1. Sign in.
2. If your register isn't open yet, you'll land on **Open Register** — enter the opening cash float and confirm.
3. On the **POS** screen: tap a category, tap products to add them to the cart (or scan a barcode — works with a USB/Bluetooth scanner automatically, no setup needed).
4. Adjust quantities, add a note or discount if needed, pick the order type (Takeaway is the default).
5. Tap **Pay** (or press `F4`), choose a payment method. For cash, enter the amount received — change is calculated for you.
6. Confirm — the receipt appears. Print it, or tap **New Order** to reset instantly for the next customer.
7. Busy and need to step away from an order? **Hold** it (`F6`) and resume it later from Held Orders.
8. At the end of the shift, go to **Register → Close Register**, count the cash drawer, enter the actual amount, and confirm — the system shows you the expected vs. actual difference before closing.
9. If you lose internet mid-sale, the app keeps working — completed sales are queued and clearly marked **Pending Sync**, then sync automatically once you're back online. They can never be double-charged.

Managers/Administrators additionally have access to Products, Categories, Inventory, Purchases, Expenses, Reports, Staff and Settings from the sidebar.

## 10. Data safety & backups

This app stores all data in your Supabase Postgres database — there is no separate/local database and no fake "backup" feature bundled with the app. For real data safety:

- Supabase Pro (and higher) plans include automatic daily backups and point-in-time recovery — check your plan's backup settings under Database → Backups.
- You can also export data yourself at any time via the Reports module (CSV export on every report) or by running `pg_dump` / using the Supabase dashboard's backup/restore tools for a full database snapshot.
- Review **Settings → Staff** periodically to make sure only current employees have active accounts, and that roles match responsibilities (least privilege).
- Retention: this project does not automatically delete historical orders/inventory transactions/audit logs — they accumulate indefinitely, which is intentional for a POS (auditability). If you need a retention/archival policy, that's a deliberate decision for the business to make, not something this template assumes for you.

## 11. Security notes

- The browser only ever receives the Supabase **anon/public** key. The service-role key is never used by this app and must never be added to any `NEXT_PUBLIC_*` variable or committed anywhere.
- Every sensitive table has Row Level Security enabled; financial-write operations (completing a sale, processing a refund, voiding an order, adjusting stock, receiving a purchase, closing a register) go through `SECURITY DEFINER` Postgres functions (RPCs) rather than raw table writes, so the business logic and authorization checks live in the database, not just in React.
- Frontend role checks (`requireRole` / hidden buttons) exist purely for UX — they are not the security boundary. Assume a technical user could bypass the UI entirely and confirm RLS still holds (it does, by design).

## 12. Known simplifications / optional future enhancements

- **PDF export**: reports and receipts rely on the browser's Print → "Save as PDF" rather than a bundled PDF-generation library, to avoid an extra heavy dependency. Straightforward to add later with a library like `@react-pdf/renderer` if you want a one-click PDF download.
- **Product cost history**: profit/estimate reports use each product's *current* cost price as an approximation for historical sales, since cost is not snapshotted per line item at sale time. Clearly labeled "estimate" throughout the Reports module. Adding a `cost_price_at_sale` column to `order_items` would make this exact.
- **Multi-payment splits**: the database and RPCs already support multiple payments per order (e.g. part cash, part card), but the current POS UI takes one payment method per sale. The payload shape makes adding a split-payment UI a non-breaking follow-up.
- **Camera barcode scanning**: enabled opportunistically via the browser's `BarcodeDetector` API where supported; USB/Bluetooth keyboard-wedge scanners are the primary, universally-supported path.
- **Kitchen screen and cashier permissions**: order status updates (New → Preparing → Ready → Completed) are restricted to Manager/Administrator by RLS today, matching the spec's cashier restrictions elsewhere; if you want cashiers to also progress kitchen tickets, loosen the `orders_update_manager` RLS policy for status-only updates.
- **Drag-and-drop reordering** for categories/payment methods uses simple up/down buttons instead of a drag library — functionally equivalent, less code.
- Replace the placeholder "ARH" icon set in `public/icons/` with your real logo (same file names/sizes: 192, 512, maskable variants) whenever you have final branding.

---

Questions or issues: check `supabase/migrations/001_initial_schema.sql` first — it's the single source of truth for what the database enforces, and every RPC used by the app is defined there with comments.
