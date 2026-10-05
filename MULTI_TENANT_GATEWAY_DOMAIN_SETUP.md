# Multi-Tenant Gateway and Domain Setup

This application uses one React frontend, one Node/Express backend, and one shared MySQL database. Tenant isolation is based on `client_id`.

## Admin Workflow

1. Sign in as a Super User and open the Admin Panel.
2. Select a client from the client scope selector.
3. Open **Homepage Content** and configure:
   - Homepage slug
   - Homepage title and introduction
   - Registration form JSON, when required
   - Custom domain
   - Published/unpublished status
4. Add the client domain in **Domain mappings**. The first domain becomes primary. Additional domains can be added for the same client.
5. Open **Payment Gateways** and create one named gateway record for every Razorpay account used by that client.
6. Open **Events** and assign one enabled gateway to every paid event.
7. Set the registration fee to `0` for a free event and leave its gateway empty.

A paid event is rejected when its client has multiple gateways and no gateway is selected. A gateway assigned to an event cannot be deleted until the event is mapped to another gateway.

## Domain and DNS Process

All client domains point to the same public server or reverse proxy:

- Add an `A` record to the server IP, or a `CNAME` to the hosting endpoint.
- Configure an SSL certificate for every client domain.
- Forward the original `Host` header to the Node backend. The backend reads `Host` or `X-Forwarded-Host` to resolve the client.
- Keep the platform domain in `VITE_PLATFORM_HOSTNAMES` so its root continues to show the login site.

Example frontend environment value:

```text
VITE_PLATFORM_HOSTNAMES=admin.example.com,www.example.com
```

If the frontend and backend use different origins, also set:

```text
VITE_API_BASE=https://api.example.com
```

When they are served from the same origin, leave `VITE_API_BASE` empty and proxy `/api` to port `5000`.

## Public Routes

- Platform root: `/`
- Custom-domain root: `/`
- Slug homepage: `/community/:clientSlug`
- Event registration: `/register/:clientSlug/:eventSlug`
- Hostname resolver API: `/api/public/current-client`
- Slug homepage API: `/api/public/clients/:clientSlug`

The custom-domain root renders the homepage content saved for the mapped client. Registration links continue to work on that same domain.

## Deployment Shape

```text
Client domain 1 ----\
Client domain 2 ----- Reverse proxy + SSL ---- React frontend
Platform domain ----/                         \
                                               Node API :5000 ---- Shared MySQL
```

Use one production process for `node Server.js` and serve the Vite build output through the reverse proxy or a static web server. Ensure the API and frontend use the same database environment values.

## Database

Migration `migrations/013_event_gateway_and_client_domains.sql` adds:

- Multiple `client_payment_gateway` rows per client
- `events.payment_gateway_id`
- `client_domains`

This migration has already been applied to the current database. Do not rerun it blindly. On a new environment, apply migrations in order before starting the backend.

## Local Commands

```text
npm run server
npm run client
npm run build
```

The backend uses port `5000`. Vite uses port `5173`, or the next available port when `5173` is occupied.

## Smoke Checks

```text
GET http://localhost:5000/api/health
GET http://localhost:5000/api/public/clients/<client-slug>
GET http://localhost:5000/api/public/current-client?domain=<mapped-domain>
```

Verify that an unmapped domain returns `404` and never returns another client's homepage.
