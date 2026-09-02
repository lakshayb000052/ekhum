# EKhum (DanaPro / WeGive) — Master Software Working Plan, Commercial Offers & Color Design System

---

## Executive Summary & System Overview

**EKhum** (architected under the **DanaPro / WeGive** engine) is an enterprise-grade **Global Philanthropy & Individual Giving Operating System** purpose-built for non-profits, international NGOs (such as ChildFund), charitable trusts, and corporate CSR foundations.

The platform bridges modern fintech payment rails (UPI Autopay, e-NACH, 4-Way Gateway Failover) with hyper-personalized donor lifecycle automation (WhatsApp & Email Visual Journeys), airtight Indian statutory tax compliance (Section 80G & Form 10BD automated filings), and an extensible CRM data architecture.

---

## 1. Complete Software Architecture & Working Plan

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    EKHUM PLATFORM                      │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
          ┌───────────────────────────┬───────────────────┴───────────────┬────────────────────────────┐
          ▼                           ▼                                   ▼                            ▼
┌──────────────────┐        ┌──────────────────┐                ┌──────────────────┐         ┌──────────────────┐
│  DONOR CHECKOUT  │        │ MULTI-GATEWAY    │                │ REAL-TIME EVENT  │         │ STATUTORY 80G &  │
│  & GIVING PAGES  │───────▶│ ROUTER & NORMAL. │───────────────▶│ BUS (11 EVENTS)  │────────▶│ FORM 10BD ENGINE │
└──────────────────┘        └──────────────────┘                └────────┬─────────┘         └──────────────────┘
                                                                         │
                                                                         ▼
                                                               ┌───────────────────┐
                                                               │  VISUAL JOURNEYS  │
                                                               │ (WHATSAPP/EMAIL)  │
                                                               └───────────────────┘
```

### 1.1 Core Technological Stack
- **Backend**: Node.js, Express.js, TypeScript, PostgreSQL (with Connection Pooling & Multi-Tenant Partitioning).
- **Frontend**: React 18, TypeScript, Vite, Tailwind-compatible CSS Variables & Modern Glassmorphism.
- **Messaging Microservice**: WhatsApp Multi-Device Gateway (`@whiskeysockets/baileys` & Meta WhatsApp Cloud API) + AWS SES for Transactional Emails.
- **Security & Compliance**: DPDP Act 2023 Consent Registry, Argon2/Bcrypt Password Hashing, JWT Session Authentication, Parametric SQL Multitenancy.

---

### 1.2 The 10 Core Software Modules

#### 1. Multi-Gateway Payment Orchestration & Smart Failover
- **Supported Gateway Rails**: Razorpay, PayU India, CCAvenue, Worldline, and Cashfree.
- **Intelligent Fallover Engine**: If the primary gateway experiences downtime, high latency (>4500ms), or bank-specific errors, transactions automatically route to secondary rails.
- **Recurring Sponsorship Engine**: Handles UPI Autopay and e-NACH mandates with automated multi-day retry schedules.
- **"Cover the Fee" Algorithm**: Donors can opt-in to cover 2–3% processing fees, guaranteeing 100%+ net settlement for the NGO.

#### 2. Visual Drag-and-Drop Journey Builder
- **Visual Canvas**: Configure multi-touch donor nurture sequences visually.
- **Node Types Supported**:
  - **Triggers**: Event-based (`donation.completed`, `subscription.created`, `mandate.failed`).
  - **Actions**: Send WhatsApp template, send rich HTML email with PDF attachment, assign CRM tasks.
  - **Logic**: Time delays (`Wait 48 Hours`), conditional branches (`Amount > ₹5,000`), quiet-hours restrictions.

#### 3. Real-Time Event Bus (11 System Triggers)
- `donation.completed`: Instantly triggers 80G PDF receipt generation and welcome series.
- `donation.failed`: Dispatches immediate 1-click retry payment link via WhatsApp within 60s.
- `subscription.created`: Enrols donor into monthly child sponsorship progress reports.
- `subscription.cancelled`: Triggers win-back feedback surveys.
- `mandate.failed`: Fires automated 3-day recovery sequence with alternate UPI prompt.
- `receipt.generated`: Delivers statutory PDF receipt to donor inbox & WhatsApp.

#### 4. Automated Section 80G & Form 10BD Tax Engine
- **Real-Time 80G Generation**: Generates tamper-evident PDFs complete with NGO 80G URN, donor PAN snapshot, cryptographic hash, and QR code verification.
- **Form 10BD Automated Export**: Generates pre-formatted CSV/Excel sheets strictly compliant with the Indian Income Tax Department schema.
- **Immutable Snapshots**: Captures donor identity and PAN at the exact instant of giving for audit defense.

#### 5. Extended CRM & Donor Data Architecture (Schema.xlsx Aligned)
- **Contacts (Donors)**: 26+ custom attributes (PAN validation, Indian postal PIN codes, total lifetime value, acquisition channels).
- **Monthly Donations (Sponsorships)**: 28+ fields (mandate tracking, child beneficiary links, upgrade history, consecutive failure counts).
- **Payment Ledger**: 12+ fields (bank UTR, net settled payout, normalized failure codes).

#### 6. Dynamic Segmentation & RFM Analytics Engine
- Real-time SQL rule builder filtering donors by Recency, Frequency, Monetary Value, Cause, and Geographic PIN code.
- Auto-updating suppression lists to respect communication opt-outs and avoid message fatigue.

#### 7. Omnichannel Broadcast & Mass Messaging Suite
- Bulk campaign broadcast scheduler via Meta WABA & AWS SES.
- Throttling rates (100–500 msgs/min) to prevent number flags.
- Real-time analytics tracking Sent, Delivered, Read, Clicked, and Bounced metrics.

#### 8. Custom Object & Field Schema Manager
- Admin capability to create custom objects (e.g., *Children*, *Schools*, *Field Projects*, *Grants*) without code changes.
- Custom field types: Text, Currency, Picklist, Date, Formula, and Relational Lookups.

#### 9. Multi-Tenant Role-Based Access Control (RBAC)
- Strict granular permissions across roles:
  - **Superadmin**: Global metrics, tenant onboarding, gateway credential governance.
  - **Org Admin**: Full control over NGO campaigns, journeys, and finances.
  - **Campaign Manager**: Landing pages, journeys, and broadcast execution.
  - **Finance Auditor**: 80G receipts, bank settlements, and 10BD exports.
  - **Read-Only Viewer**: Executive dashboards and reporting.

#### 10. AI Analytics & Copilot Engine
- AI-driven donor propensity scoring, automated child impact report writer, and smart churn predictor for monthly pledges.

---

### 1.3 End-to-End Operational Lifecycle Workflow

```
[Donor Visits Campaign Page]
             │
             ▼
[Fills Form & Selects Frequency (One-Time / Monthly Pledge)]
             │
             ▼
[Payment Router Evaluates Health & Routes via Razorpay/PayU/CCAvenue]
             │
             ▼
[Payment Successful ──▶ Event Bus Fires "donation.completed"]
             │
     ┌───────┴───────────────────────────┐
     ▼                                   ▼
[80G Receipt PDF Generated]     [Visual Journey Enrolment]
     │                                   │
     ▼                                   ▼
[Delivered via WhatsApp & Email] [Day 2: Child Bio ──▶ Day 7: Video Update]
     │
     ▼
[Annual March Consolidation ──▶ 1-Click Form 10BD Filing to Tax Portal]
```

---

## 2. Commercial Offers & Value Propositions to Clients

When presenting EKhum to non-profits, foundations, and child sponsorship charities, use these tailored commercial packages and value propositions:

| # | Commercial Offer Name | Target Client Problem | Solution Delivered | Business / ROI Impact |
|---|---|---|---|---|
| **1** | **0.0% Platform Fee Core Guarantee** | Traditional platforms charge 3%–8% of total funds raised. | 100% of donor funding goes directly to the NGO’s bank account. | Saves ₹5L to ₹50L+ annually in platform commissions. |
| **2** | **4-in-1 Gateway Redundancy & Zero-Drop Guarantee** | Peak campaign server crashes & single-gateway bank downtime. | Dynamic auto-switch between Razorpay, PayU, CCAvenue & Worldline. | **-70% drop-offs**; recovers up to 15–20% lost donations. |
| **3** | **Automated Sponsor Retention & Anti-Churn Suite** | 25%–35% annual lapse in recurring child sponsorship pledges. | Automated WhatsApp child updates + 3-step instant UPI retry links. | **+35% sponsor retention** & higher lifetime value (LTV). |
| **4** | **Frictionless 80G & 1-Click Form 10BD Compliance** | Hundreds of manual hours spent in March issuing tax receipts. | Instant automated PDF dispatch + 1-click Income Tax filing export. | **85% reduction** in support tickets; 100% audit-proof. |
| **5** | **Donor "Cover the Processing Fee" Model** | Payment gateway fees (1.8–2.5%) erode fundraising margins. | Smart toggle asking donors to add ₹25–₹50 to cover bank costs. | Over **65% of donors opt-in**, yielding net 100%+ collections. |
| **6** | **High-Converting White-Label Giving Pages** | Outdated NGO websites with slow, multi-step checkouts. | Mobile-first giving pages, instant UPI intent flow, custom domain. | **+42% conversion rate** on mobile and social traffic. |
| **7** | **Enterprise DPDP Act & Data Sovereignty Assurance** | Strict Indian data protection laws & child privacy concerns. | Isolated tenant databases, encrypted PAN storage, full consent audit logs. | Zero compliance risk under the Digital Personal Data Protection Act. |

---

### 2.1 Tiered Client Packaging & Pricing Structure

#### Tier 1: "Emerging Impact" (Starter Package)
- **Target**: Regional non-profits, small charitable trusts.
- **Includes**:
  - Single/Dual Gateway (Razorpay + PayU).
  - Automated 80G Receipt generation & email delivery.
  - Basic donor CRM (Up to 10,000 contacts).
  - Standard 1-Click Form 10BD export.
  - Zero Platform Fee on all donations.

#### Tier 2: "Growth Accelerator" (Most Popular)
- **Target**: Mid-sized NGOs, national fundraising foundations.
- **Includes**:
  - Everything in Starter +
  - 4-Way Multi-Gateway Routing with automated failover.
  - Visual Drag-and-Drop Journey Builder (Up to 10 active journeys).
  - WhatsApp Cloud API integration for instant receipt & video updates.
  - Automated Mandate Failure Recovery engine (e-NACH + UPI Autopay).
  - Up to 100,000 contacts & RFM Dynamic Segmentation.

#### Tier 3: "Enterprise Philanthropy Suite" (Custom / ChildFund Scale)
- **Target**: Large international NGOs, multi-state child sponsorship programs, hospital trusts.
- **Includes**:
  - Everything in Growth +
  - Dedicated isolated database instance & white-label custom domain.
  - Unlimited active journeys, broadcasts, and contacts.
  - Custom Object & Schema Manager tailored to organization hierarchy.
  - Custom ERP/CRM bi-directional sync (SAP, Microsoft Dynamics, NetSuite).
  - 24/7 Priority SLA, dedicated technical relationship manager, and full data migration support.

---

## 3. Software Color Theme & Design System

The software uses a **Clean Light Mode Design System** combining **Emerald Green** (representing growth, prosperity, and philanthropy) and **Deep Space Navy** (representing institutional security and trust).

### 3.1 Primary Brand Color Palette

| Token / Usage | Color Name | Hex Code | RGB | HSL / CSS Value |
|---|---|---|---|---|
| **Primary Brand** | Emerald Green | `#059669` | `rgb(5, 150, 105)` | `hsl(160, 84%, 39%)` |
| **Primary Light / Accent**| Bright Emerald | `#10B981` | `rgb(16, 185, 129)` | `hsl(160, 84%, 48%)` |
| **Primary Subtle / Tint** | Mint Whisper | `#ECFDF5` | `rgb(236, 253, 245)` | `hsl(160, 84%, 96%)` |
| **Title & Primary Text**  | Deep Space Navy | `#0F172A` | `rgb(15, 23, 42)` | `hsl(222, 47%, 11%)` |
| **Dark Neutral / Header** | Slate Navy | `#1E293B` | `rgb(30, 41, 59)` | `hsl(217, 33%, 17%)` |
| **Body Text**             | Slate Gray | `#475569` | `rgb(71, 85, 105)` | `hsl(215, 19%, 35%)` |
| **Muted Text / Secondary**| Steel Muted | `#64748B` | `rgb(100, 116, 139)` | `hsl(215, 16%, 47%)` |

---

### 3.2 Secondary & Functional Accent Palette

| Functional Role | Color Name | Hex Code | RGB | HSL / CSS Value | Application |
|---|---|---|---|---|---|
| **Tech & Action Accent** | Royal Blue | `#2563EB` | `rgb(37, 99, 235)` | `hsl(221, 83%, 53%)` | Active tabs, primary buttons, charts |
| **Secondary Brand Glow** | Vibrant Blue | `#3B82F6` | `rgb(59, 130, 246)` | `hsl(217, 91%, 60%)` | Interactive highlights, links |
| **Cyan / Info Badge**    | Ocean Sky | `#0284C7` | `rgb(2, 132, 199)` | `hsl(201, 98%, 39%)` | Informational callouts & stats |
| **Teal Secondary**       | Deep Teal | `#0D9488` | `rgb(13, 148, 136)` | `hsl(175, 84%, 32%)` | Logo gradient & badge backgrounds |
| **Warning / Notice**     | Amber Gold | `#D97706` | `rgb(217, 119, 6)` | `hsl(38, 92%, 50%)` | Pending mandates, retry alerts |
| **Error / Drop-Off**     | Crimson Red | `#DC2626` | `rgb(220, 38, 38)` | `hsl(0, 75%, 60%)` | Failed transactions, lapsed donors |
| **Warning Soft Pill**    | Amber Tint | `#FEF3C7` | `rgb(254, 243, 199)`| `hsl(48, 96%, 89%)` | Status tags for `Pending` items |
| **Error Soft Pill**      | Rose Tint | `#FEE2E2` | `rgb(254, 226, 226)`| `hsl(0, 93%, 94%)` | Status tags for `Failed` items |

---

### 3.3 Surface & Canvas Tokens

| Token | Hex Code | CSS Variable | Purpose |
|---|---|---|---|
| **App Canvas / Page BG** | `#F8FAFC` | `--background` / `--bg-main` | Ultra-clean soft slate page backdrop |
| **Surface / Card White** | `#FFFFFF` | `--surface` / `--bg-card` | Pure white cards, modal bodies, table containers |
| **Subtle Card Fill**     | `#F1F5F9` | `--bg-subtle` / `--secondary-light` | Inactive tab backgrounds, code blocks |
| **Border Neutral**       | `#E2E8F0` | `--border` | Subtle card borders, data table dividers |
| **Border Emerald Accent**| `#A7F3D0` | `--border-emerald` | Highlighted KPI cards, active focus rings |

---

### 3.4 Brand Gradient System

```css
/* Logo Primary Brand Gradient */
background: linear-gradient(135deg, #3B82F6 0%, #0D9488 45%, #10B981 80%, #F59E0B 100%);

/* Accent Gradient for Badges & Buttons */
background: linear-gradient(135deg, #059669 0%, #0D9488 100%);

/* Header Glassmorphism Gradient */
background: linear-gradient(135deg, rgba(236, 253, 245, 0.8) 0%, rgba(239, 246, 255, 0.8) 100%);
```

---

### 3.5 Typography & Component Rules
- **Display & Headings**: `Plus Jakarta Sans` / `Outfit` (`font-weight: 700 / 800`, line height `1.25`).
- **Body & Controls**: `Inter` (`font-weight: 400 / 500 / 600`, line height `1.6`).
- **Monospace (Amounts & Identifiers)**: `JetBrains Mono` (used for ₹ Currency values, URNs, PAN numbers, and Gateway Transaction IDs).
- **Cards & Elevation**:
  - `border-radius: 12px` (Cards) & `18px` (Widgets).
  - Box Shadow: `0 4px 12px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.02)`.
  - Hover Transition: `transform translateY(-2px)` with subtle border highlight.

---

## 4. 4-Week Rapid Deployment & Client Onboarding Roadmap

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     WEEK 1      │    │     WEEK 2      │    │     WEEK 3      │    │     WEEK 4      │
│  Gateway Setup  │───▶│ Legacy Migrate  │───▶│ Journey Builder │───▶│  Pilot Launch   │
│ & WABA Connect  │    │ & Historical PAN│    │ & Tax Templates │    │ & Staff Training│
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

1. **Week 1 (Infrastructure & Payment Configuration)**: Configure sub-merchant accounts across Razorpay/PayU and connect Meta WhatsApp Business Account (WABA).
2. **Week 2 (Data Migration & Cleansing)**: Ingest historical donor base, active e-NACH/UPI mandates, and statutory 80G registers into PostgreSQL.
3. **Week 3 (Journey & Template Customization)**: Configure custom welcome series, child progress update templates, and 80G receipt layout.
4. **Week 4 (Go-Live & Validation)**: Launch live campaign checkout page, run end-to-end test transactions, and train the NGO finance and fundraising teams.
