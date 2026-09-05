# EKhum (DanaPro / Philanthropy OS) — API Specification & Webhook Contracts

---

## 1. Overview & API Architecture

EKhum exposes two primary API tiers:
1. **Public Donor & Checkout API (`/api/public/*`)**: High-throughput, token-authenticated giving endpoints for mobile apps, website widgets, and checkout pages.
2. **Authenticated NGO & Admin REST API (`/api/*`)**: Secure JWT/API Key endpoints for CRM operations, visual journeys, campaign management, tax certificates, and analytics.

### Global Standards
- **Transport**: HTTPS / TLS 1.3 only.
- **Payload Format**: `application/json` with UTF-8 encoding.
- **Authentication**:
  - Web Sessions: HttpOnly Secure JWT Cookie (`ekhum_token`).
  - Server-to-Server: Bearer API Key header (`Authorization: Bearer ek_live_...`).
- **Idempotency**: All mutating operations (`POST`, `PUT`) accept an `Idempotency-Key` header (UUIDv4) to guarantee zero double-charging.
- **Rate Limits**:
  - Public Checkout: 30 requests/min per IP.
  - Authenticated API: 120 requests/min per API key.

---

## 2. Public Checkout & Giving Endpoints

### 2.1 Initiate Checkout Session
Initiates an order with the intelligent payment router, calculating fee-cover options and checking gateway health.

- **Endpoint**: `POST /api/public/checkout/initiate`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <UUID>`
- **Request Body**:
```json
{
  "organization_slug": "childfund-india",
  "campaign_slug": "sponsor-a-child-2024",
  "amount": 1500.00,
  "currency": "INR",
  "frequency": "monthly",
  "cover_fee": true,
  "donor": {
    "first_name": "Aarav",
    "last_name": "Sharma",
    "email": "aarav.sharma@example.com",
    "phone": "+919876543210",
    "tax_id": "ABCPS1234F",
    "tax_id_type": "PAN",
    "address": "402, Green Park",
    "city": "Bengaluru",
    "state": "Karnataka",
    "zip_code": "560001",
    "country": "IN"
  },
  "consent_whatsapp": true,
  "consent_email": true,
  "utm_params": {
    "utm_source": "meta",
    "utm_medium": "cpc",
    "utm_campaign": "sponsor_child_q3"
  }
}
```

- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "donation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "gross_amount": 1545.00,
    "base_amount": 1500.00,
    "fee_covered": 45.00,
    "currency": "INR",
    "selected_gateway": "razorpay",
    "gateway_payload": {
      "order_id": "order_EKH123456789",
      "key_id": "rzp_live_abcdef123456",
      "amount_in_paise": 154500,
      "currency": "INR",
      "prefill": {
        "name": "Aarav Sharma",
        "email": "aarav.sharma@example.com",
        "contact": "+919876543210"
      },
      "theme": {
        "color": "#0D9488"
      }
    }
  }
}
```

---

### 2.2 Verify Payment & Trigger Lifecycle
Called immediately upon frontend gateway callback to verify cryptographic signature and trigger async event bus.

- **Endpoint**: `POST /api/public/checkout/verify`
- **Request Body**:
```json
{
  "donation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "gateway": "razorpay",
  "gateway_payment_id": "pay_EKH987654321",
  "gateway_order_id": "order_EKH123456789",
  "gateway_signature": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

- **Success Response (`200 OK`)**:
```json
{
  "status": "captured",
  "donation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "receipt_url": "https://cdn.ekhum.org/receipts/rec_2024_008912.pdf",
  "receipt_number": "CF-80G-2024-008912",
  "message": "Payment verified and 80G receipt issued successfully."
}
```

---

## 3. Core NGO Management & CRM Endpoints

### 3.1 Donors & Contacts
- `GET /api/contacts` — Paginated list of donors with RFM scores, lifetime value (LTV), and communication preferences.
- `GET /api/contacts/:id` — Full constituent profile, giving timeline, mandate status, and active journey enrollments.
- `POST /api/contacts` — Manual donor onboarding / telecalling lead creation.
- `PATCH /api/contacts/:id` — Update contact details and communication opt-ins.

### 3.2 Campaigns & Giving Pages
- `GET /api/campaigns` — List all active fundraising initiatives and revenue progress.
- `POST /api/campaigns` — Create new campaign appeal with ask amount presets and custom fields.
- `GET /api/landing-pages` — List landing page variants with conversion rate metrics.
- `POST /api/landing-pages` — Publish new responsive giving page variant.

### 3.3 Statutory Section 80G & Form 10BD
- `GET /api/compliance/receipts` — Search tax receipts by financial year, donor PAN, or receipt number.
- `POST /api/compliance/receipts/:id/reissue` — Amend and reissue tax receipt with audit trail.
- `POST /api/compliance/form-10bd/generate` — Compile and export CBDT-compliant Form 10BD CSV for fiscal year.
- `GET /api/compliance/form-10bd/status` — Track filing acceptance status and acknowledgment numbers.

### 3.4 Visual Journeys & Automated Sequences
- `GET /api/journeys` — List visual automation workflows and active enrolments.
- `POST /api/journeys` — Save or update visual journey node graph (React Flow schema).
- `POST /api/journeys/:id/publish` — Validate and activate new journey version.
- `POST /api/journeys/:id/pause` — Temporarily suspend enrolments and queue execution.

---

## 4. Webhook Ingress & Egress Contracts

### 4.1 Ingress: Payment Gateway Webhooks
- **Razorpay Endpoint**: `POST /api/webhooks/razorpay`
  - **Header**: `X-Razorpay-Signature: <HMAC-SHA256>`
  - **Events Handled**: `payment.captured`, `payment.failed`, `subscription.charged`, `subscription.cancelled`
- **PayU Endpoint**: `POST /api/webhooks/payu`
  - **Header**: `X-PayU-Hash: <SHA-512>`
  - **Events Handled**: `SUCCESS`, `FAILURE`, `SIP_SUCCESS`
- **Meta WhatsApp Endpoint**: `POST /api/webhooks/whatsapp`
  - **Header**: `X-Hub-Signature-256: sha256=<HMAC-SHA256>`
  - **Events Handled**: `messages` (read receipts, incoming text replies, button clicks)

### 4.2 Egress: Outbound NGO Integrations
NGOs can configure outbound webhooks to receive real-time notifications in Salesforce, HubSpot, or internal ERPs.

- **Payload Format**:
```json
{
  "event": "donation.completed",
  "event_id": "evt_01J6K8M9N0PQR1S2T3U4V5W6X7",
  "timestamp": "2026-09-04T17:15:30Z",
  "organization_id": "7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
  "data": {
    "donation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "amount": 1500.00,
    "currency": "INR",
    "donor_name": "Aarav Sharma",
    "donor_email": "aarav.sharma@example.com",
    "campaign_title": "Sponsor a Child 2024",
    "receipt_number": "CF-80G-2024-008912",
    "receipt_pdf_url": "https://cdn.ekhum.org/receipts/rec_2024_008912.pdf"
  }
}
```
- **Signature Header**: `X-Ekhum-Signature: t=1725470130,v1=9f83...` (Computed using HMAC-SHA256 with the tenant's webhook secret).

---

## 5. Standard Error Code Taxonomy

All API error responses follow the RFC 7807 problem details specification:

```json
{
  "error": {
    "code": "INVALID_PAN_FORMAT",
    "message": "The provided PAN number does not conform to Indian Income Tax format.",
    "field": "donor.tax_id",
    "help_url": "https://docs.ekhum.org/errors/INVALID_PAN_FORMAT"
  }
}
```

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Schema validation failed on input body |
| `400 Bad Request` | `INVALID_PAN_FORMAT` | Indian PAN structure invalid (Must be `[A-Z]{5}[0-9]{4}[A-Z]{1}`) |
| `401 Unauthorized`| `UNAUTHORIZED` | Missing or expired JWT / API Key |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | Role does not have required scope |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Specified record does not exist or belongs to another tenant |
| `409 Conflict` | `IDEMPOTENCY_CONFLICT` | A transaction with this idempotency key is already processing |
| `429 Too Many Req`| `RATE_LIMIT_EXCEEDED` | Request threshold reached; retry after `Retry-After` header |
| `502 Bad Gateway` | `GATEWAY_UNAVAILABLE` | Primary and failover payment rails failed to respond |
