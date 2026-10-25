# GEU Complaint Portal

The frontend is React/Vite in `frontend/`. The backend is JavaScript, Node.js, Express and MongoDB in `backend/`; its entry point is `backend/src/server.js`. Routes, models, middleware and services have separate folders.

## Run locally

1. Start MongoDB locally or create a MongoDB Atlas database.
2. In `backend/`, run `npm ci`, copy `.env.example` to `.env`, and set `MONGODB_URI`, `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` (at least 10 characters). The password creates the Super Admin on a new database; the Super Admin must change it at first email sign-in. Changing the environment value later does not reset an existing account.
3. Run `npm start` in `backend/`. The API starts on port 4000 by default. You can also run `node server.js` from `backend/src/`.
4. In `frontend/`, run `npm ci` and `npm run dev`. Open `http://localhost:5173` and sign in with the Super Admin credentials from `.env`.

Vite proxies `/api` to the Express server. Set `API_TARGET` when the API uses another local host or port. In production, serve the frontend and API from the same origin, or configure `FRONTEND_ORIGIN` and secure cross-site cookies over HTTPS.

New databases start with only the Super Admin (stored internally as `MAIN_ADMIN`). The Super Admin can create campuses, buildings, floors, labs/rooms, asset types, read-only Admins, Sub-Admins, Lab Assistants and routing rules in the portal. To load the included example locations and asset types into an empty database, set `SEED_REFERENCE_DATA=true` before starting the API. Example user accounts are not imported.

Ticket and account data, sessions, audit logs and images are stored in MongoDB. Issue and evidence images are limited to 5 MB each. Back up the MongoDB database for persistence.

## Role flows

- **Super Admin:** manages Users, Roles, Locations, Asset Types and Routing Rules; sees all tickets; can assign/reassign, reopen and cancel; reviews Escalations, Reports and Audit Logs. Reports can be downloaded as CSV.
- **Admin (read only):** sees the campus dashboard, all tickets and the unassigned queue. Can inspect ticket status, assignee, creator, images, evidence and the full activity history, including internal staff notes. Cannot create users or tickets, assign work, post notes, upload evidence or change status or settings. The API enforces these restrictions.
- **Sub-Admin:** logs in through the portal and sees only assigned tickets. They can start work, add internal notes, upload resolution evidence, mark resolved and request escalation if granted permission. The API checks assignment on each ticket operation.
- **Lab Assistant:** can create a complaint through the portal; sees only their tickets; can add updates and confirm or dispute a resolution.

A resolver must upload evidence before marking a ticket resolved. The Lab Assistant can dispute a resolution within 72 hours. Ticket access is checked server-side, including direct API requests and image downloads.

## Sign-in and MSG91 SMS setup

Users can sign in with a registered mobile number and a six-digit SMS code, or with an email address and password. The portal generates, stores, expires and verifies the SMS code itself. MSG91 is used only to send an ordinary SMS through its [Send SMS flow API](https://docs.msg91.com/sms/send-sms); the MSG91 OTP service is not used. Configure an approved MSG91 SMS template with `VAR1` as the six-digit code, then set `MSG91_AUTH_KEY` and `MSG91_SMS_TEMPLATE_ID` in `backend/.env`. The template text should say the code is for GEU portal sign-in and expires in five minutes. MSG91 account setup, sender ID and any required SMS template approvals must be completed before live delivery.

Codes expire after five minutes, are single-use, and allow five verification attempts. Requests have a one-minute resend wait and request limits. The application stores only a password hash of each code. SMS provider credentials are kept on the server. Email sign-in with an administrator-issued initial or reset password leads to a required password-change screen; API access is blocked until the password is changed. A mobile-only account can sign in without a password. Existing WhatsApp ticket source labels are retained for historical records, but the WhatsApp bot and webhook are removed.

## API and tests

The API prefix is `/api/v1`. Auth uses an HttpOnly session cookie. The main routes are `/auth`, `/reference`, `/admin/users`, `/admin/locations`, `/admin/asset-types`, `/routing/rules`, `/tickets`, `/uploads`, `/admin/reports`, and `/admin/audit-logs`.

Run `npm test` in `backend/` for the MongoDB and role workflow integration test. The test uses `MONGODB_TEST_URI` if set; otherwise it looks for a local `mongod` binary. Set `MONGOD_BINARY` to another binary path if needed. The test covers first-login password changes and the MSG91 SMS request and verification flow with a mocked SMS response.
