# GEU Complaint Portal

The frontend is React/Vite in `frontend/`. The backend is JavaScript, Node.js, Express and MongoDB in `backend/`; its entry point is `backend/src/server.js`. Routes, models, middleware and services have separate folders.

## Run locally

1. Start MongoDB locally or create a MongoDB Atlas database.
2. In `backend/`, run `npm ci`, copy `.env.example` to `.env`, and set `MONGODB_URI`, `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` (at least 10 characters). The password creates the Main Admin on a new database; changing the environment value later does not reset an existing account.
3. Run `npm start` in `backend/`. The API starts on port 4000 by default. You can also run `node server.js` from `backend/src/`.
4. In `frontend/`, run `npm ci` and `npm run dev`. Open `http://localhost:5173` and sign in with the Main Admin credentials from `.env`.

Vite proxies `/api` to the Express server. Set `API_TARGET` when the API uses another local host or port. In production, serve the frontend and API from the same origin, or configure `FRONTEND_ORIGIN` and secure cross-site cookies over HTTPS.

New databases start with only the Main Admin. The Main Admin can create campuses, buildings, floors, labs/rooms, asset types, Sub-Admins, Lab Assistants and routing rules in the portal. To load the included example locations and asset types into an empty database, set `SEED_REFERENCE_DATA=true` before starting the API. Example user accounts are not imported.

Ticket and account data, sessions, audit logs and images are stored in MongoDB. Issue and evidence images are limited to 5 MB each. Back up the MongoDB database for persistence.

## Role flows

- **Main Admin:** manages Users, Roles, Locations, Asset Types and Routing Rules; sees all tickets; can assign/reassign, reopen and cancel; reviews Escalations, Reports and Audit Logs. Reports can be downloaded as CSV.
- **Sub-Admin:** logs in through the portal and sees only assigned tickets. They can start work, add internal notes, upload resolution evidence, mark resolved and request escalation if granted permission. The API checks assignment on each ticket operation.
- **Lab Assistant:** can create a complaint through the portal or, when configured, WhatsApp; sees only their tickets; can add updates and confirm or dispute a resolution.

A resolver must upload evidence before marking a ticket resolved. The Lab Assistant can dispute a resolution within 72 hours. Ticket access is checked server-side, including direct API requests and image downloads.

## WhatsApp Cloud API

Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_API_VERSION` in `backend/.env` when the official business number is ready. Configure the Meta webhook callback to `https://YOUR_PUBLIC_HOST/api/v1/webhooks/whatsapp`, subscribe to the `messages` field, and use the same verify token. A reachable HTTPS endpoint is required for Meta to deliver messages. Only registered, active Lab Assistant mobile numbers enter the bot workflow.

The bot supports Create New Ticket, My Active Tickets, Check Ticket Status, Add Information and Help/Cancel. Ticket creation requires an image, asset, campus → building → floor → lab selection, a description and explicit confirmation. Interactive lists and reply buttons are sent through the [official Meta Cloud API message endpoint](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages). Incoming image IDs are resolved through the [Meta media endpoint](https://www.postman.com/meta/whatsapp-business-platform/request/ptjyi84/retrieve-media-url). The webhook verifies Meta's HMAC signature over the raw request body and deduplicates message IDs.

If you have an approved two-parameter status template, set `WHATSAPP_STATUS_TEMPLATE` to its name. Its body parameters must be ticket code and status, in that order. Without a template, the backend attempts a normal text update; Meta may reject text outside the customer-service conversation window. Portal status updates remain available regardless of WhatsApp delivery.

## API and tests

The API prefix is `/api/v1`. Auth uses an HttpOnly session cookie. The main routes are `/auth`, `/reference`, `/admin/users`, `/admin/locations`, `/admin/asset-types`, `/routing/rules`, `/tickets`, `/uploads`, `/admin/reports`, `/admin/audit-logs` and `/webhooks/whatsapp`.

Run `npm test` in `backend/` for the MongoDB and role workflow integration test. The test uses `MONGODB_TEST_URI` if set; otherwise it looks for a local `mongod` binary. Set `MONGOD_BINARY` to another binary path if needed. The test also exercises a signed webhook fixture and verifies that bot ticket creation waits for confirmation.
