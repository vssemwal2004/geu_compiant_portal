# GEU Complaint Portal

The API is a JavaScript Node.js and Express server at `backend/src/server.js`. The React frontend is in `frontend/`.

## Run locally

1. In `backend/`, run `npm ci` and copy `.env.example` to `.env`. Set `SEED_ADMIN_PASSWORD` to a unique password of at least 10 characters. The existing `.env`, if present, may contain placeholder values; replace those before first start.
2. Run `npm start` in `backend/`. The API listens on port 4000 by default.
3. In `frontend/`, run `npm ci` and `npm run dev`. Open `http://localhost:5173`.
4. Sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

Vite proxies `/api` to the Express server. Set `API_TARGET` when the server uses a different host or port. For production, serve the frontend and API from the same origin or set `FRONTEND_ORIGIN` to the frontend origin and enable secure cookies over HTTPS.

The server writes accounts, sessions, reference data, tickets and images to `backend/data/store.json`. Back up this file to retain data. The file is created on first start and is excluded from Git. The committed `backend/data/reference.json` supplies the initial campus, asset, and sample account names. Only the Main Admin account is activated automatically. Sample accounts become usable when the Main Admin sets passwords through the API.

## Account setup

After signing in, call `PATCH /api/v1/admin/users/:id` with JSON such as `{ "password": "a-unique-password-of-10-or-more-characters" }` to activate a sample account. Use `GET /api/v1/admin/users` to find account IDs. You can also create accounts with `POST /api/v1/admin/users` using `name`, `email`, `employeeId`, `role`, `password`, and optional `allowedLocationIds`. Supported roles are `SUB_ADMIN` and `LAB_ASSISTANT`. The Main Admin can also manage routing rules with `/api/v1/admin/routing-rules`.

All protected requests use an HttpOnly session cookie. The main frontend flow uses `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/reference`, and `/api/v1/tickets` and its status, message, assignee and escalation actions.
