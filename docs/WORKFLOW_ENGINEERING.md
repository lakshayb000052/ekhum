# EKhum (DanaPro / Philanthropy OS) — Working Flow & System Lifecycle Specification

---

## 1. Executive Summary & Flow Philosophy

This document defines the end-to-end execution flows, state machines, business logic lifecycles, and asynchronous event chains that drive **EKhum**.

The platform is designed around **reactive event-driven orchestration**: every donor action (page view, form focus, payment attempt, gateway webhook, tax receipt issuance, WhatsApp reply) emits an immutable event into the system's central event bus. Subscribed micro-engines (Journey Executor, Tax Engine, Messaging Router, RFM Rollup Engine) react asynchronously without blocking checkout throughput.

---

## 2. End-to-End Master Giving Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Donor as Donor / Sponsor
    participant Web as Giving Page / Embed Widget
    participant Edge as WAF / API Gateway
    participant PR as Payment Router Engine
    participant PG as Payment Gateway (Razorpay/PayU/CCAvenue)
    participant EB as Reactive Event Bus
    participant TE as 80G Tax Engine
    participant JE as Journey Executor
    participant MS as Messaging Service (Meta WABA / AWS SES)

    Donor->>Web: 1. Selects Cause & Amount (One-Time / ₹1,500 Monthly)
    Donor->>Web: 2. Enters PAN, Name, Email, WhatsApp & Opts-in (DPDP)
    Web->>Edge: 3. POST /api/public/checkout/initiate (with Idempotency Key)
    Edge->>PR: 4. Route Selection & Gateway Health Check
    PR-->>PG: 5. Create Order / Mandate Token (UPI Autopay / Netbanking)
    PG-->>PR: 6. Gateway Session / Intent Payload
    PR-->>Web: 7. Open UPI Intent / Gateway Modal
    Donor->>PG: 8. Authorizes UPI Pin / Bank Authentication
    PG-->>Edge: 9. Webhook: payment.captured / mandate.active (HMAC Verified)
    Edge->>PR: 10. Process Webhook & Idempotently Update DB
    PR->>EB: 11. Emit "donation.completed" / "subscription.created"
    
    par Async Tax Receipting
        EB->>TE: 12. Trigger Instant 80G Receipt Generation
        TE->>TE: 13. Create Snapshot, Calc SHA-256 Hash & QR Code
        TE->>MS: 14. Dispatch 80G PDF via WhatsApp & Email
        MS-->>Donor: 15. Instant WhatsApp Receipt Notification (<60s)
    and Async Journey Onboarding
        EB->>JE: 16. Enrol Donor in "New Sponsor Welcome Journey"
        JE->>JE: 17. Queue Step 1 (Immediate Impact Bio)
        JE->>MS: 18. Dispatch Welcome Video & Beneficiary Profile
        MS-->>Donor: 19. WhatsApp Rich Media Welcome Card
    end
```

---

## 3. Intelligent Multi-Gateway Routing & 4-Way Failover Flow

To guarantee a **Zero-Drop Checkout Guarantee**, the Payment Router evaluates live gateway health, latency metrics, and transaction outcomes across Razorpay, PayU, CCAvenue, Cashfree, and Worldline.

### Failover Decision Tree

```mermaid
flowchart TD
    Start([Donor Submits Checkout]) --> CheckPref[Evaluate Org Gateway Priority]
    CheckPref --> HealthCheck{Is Primary Gateway Healthy?<br/>Latency < 4500ms & Error Rate < 5%}
    
    HealthCheck -- Yes --> InitPrimary[Initialize Primary Rail e.g., Razorpay]
    HealthCheck -- No --> Failover1[Auto-Failover to Secondary e.g., PayU]
    
    InitPrimary --> AttemptPrimary{Order Creation / SDK Response}
    AttemptPrimary -- Success --> PresentCheckout[Present Checkout UI to Donor]
    AttemptPrimary -- Network / Bank Error --> Failover1
    
    Failover1 --> InitSecondary[Initialize Secondary Rail]
    InitSecondary --> AttemptSec{Response OK?}
    AttemptSec -- Success --> PresentCheckout
    AttemptSec -- Failed --> Failover2[Auto-Failover to Tertiary e.g., CCAvenue]
    
    Failover2 --> PresentCheckout
    
    PresentCheckout --> DonorAuth{Donor Authorizes Payment}
    DonorAuth -- Approved --> Captured([Status: Captured -> Fire Event Bus])
    DonorAuth -- Bank Declined / Expired --> RetryLink([Dispatch 1-Click WhatsApp Instant Retry Link])
```

### Gateway Health Matrix & Metrics Tracked
1. **Latency Threshold**: If gateway API p95 response time exceeds `4,500ms`, traffic is shifted to the next priority rail for 10 minutes.
2. **Error Rate Threshold**: If 3 consecutive transactions fail with `GATEWAY_DOWN` or `5xx SERVER_ERROR`, rail enters circuit-breaker `OPEN` state.
3. **Smart BIN/VPA Routing**: HDFC/ICICI bank netbanking routes to the gateway with highest direct-settlement success rates for that bank.

---

## 4. Recurring Sponsorship & Mandate Recovery Flow (Anti-Churn Engine)

Recurring child sponsorship and monthly giving pledges suffer from 25–35% annual involuntary churn due to expired cards, low UPI balances, or bank downtime on debit day. EKhum solves this with an automated 3-stage recovery cycle.

```mermaid
stateDiagram-v2
    [*] --> MandateActive: Mandate Registered (UPI / e-NACH)
    
    MandateActive --> ScheduledDebit: Debit Day (e.g., 5th of Month)
    ScheduledDebit --> DebitSuccess: Bank Processes Debit
    DebitSuccess --> MandateActive: 80G Issued & Child Update Sent
    
    ScheduledDebit --> FirstFail: Bank Decline (Low Balance / Tech Error)
    
    state FirstFail {
        [*] --> WhatsAppAlert1: Dispatch Instant WhatsApp Soft Reminder
        WhatsAppAlert1 --> AutoRetry1: Retry Auto-Debit in 48h
    }
    
    AutoRetry1 --> DebitSuccess: Retry Succeeded
    AutoRetry1 --> SecondFail: Retry Failed (Attempt 2)
    
    state SecondFail {
        [*] --> WhatsAppAltUPI: Send 1-Click Alternate UPI Pay Link
        WhatsAppAltUPI --> AutoRetry2: Final Gateway Debit in 72h
    }
    
    AutoRetry2 --> DebitSuccess: Paid via UPI / Retried
    AutoRetry2 --> LapsedState: 3 Consecutive Failures
    
    state LapsedState {
        [*] --> CRMTask: Flag to NGO Donor Care Helpdesk
        CRMTask --> PhoneFollowUp: Telecaller Direct Outreach
    }
    
    LapsedState --> MandateActive: Mandate Renewed / Re-registered
    LapsedState --> Cancelled: Donor Cancels / Churned
```

---

## 5. Visual Drag-and-Drop Journey Builder Execution Engine

The Journey Executor engine processes complex, multi-touch donor nurture sequences configured visually by NGO campaign managers.

### Node Architecture & Graph Representation

```mermaid
graph TD
    Trigger([Trigger: donation.completed > ₹2,500]) --> Delay1[Delay Node: Wait 24 Hours]
    Delay1 --> Cond1{Condition Node: Has WhatsApp Consent?}
    
    Cond1 -- Yes --> Quiet1{Quiet Hours Check: 9:00 PM - 8:00 AM IST?}
    Cond1 -- No --> EmailStep[Action Node: Send Email Impact Report]
    
    Quiet1 -- Inside Quiet Hours --> Snooze[Queue for Next 8:01 AM Window]
    Quiet1 -- Outside Quiet Hours --> WABAStep[Action Node: Send WABA Video Template]
    Snooze --> WABAStep
    
    WABAStep --> Delay2[Delay Node: Wait 5 Days]
    EmailStep --> Delay2
    
    Delay2 --> GoalCheck{Goal Node: Did Donor Share Link or Upgrade?}
    GoalCheck -- Yes --> GoalHit([Goal Achieved: Tag 'Advocate'])
    GoalCheck -- No --> ExitJourney([Natural Journey Completion])
```

### Step Execution Algorithm
1. **Event Trigger Ingestion**: When an event occurs (e.g. `donation.completed`), the engine scans all active journeys with matching `entry_event_type`.
2. **Eligibility & Suppression Check**: The engine verifies:
   - Donor is not already active in this journey (if `re_entry_allowed = false`).
   - Donor has not opted out of communications.
   - Max concurrent journeys limit has not been exceeded.
3. **Step Scheduling**: A `journey_enrolments` record is created with `current_step_id` pointing to the first node and `next_action_due_at = NOW() + wait_duration`.
4. **Worker Execution Loop**: A high-frequency queue worker queries records where `status = 'active'` AND `next_action_due_at <= NOW()`:
   - Evaluates node conditionals (`amount > 5000`, `city = 'Mumbai'`).
   - Dispatches communication via `messagingRouter`.
   - Advances pointer to `true_branch_step_id` or `false_branch_step_id`.
   - Marks enrolment as `completed` upon reaching terminal leaf nodes.

---

## 6. Statutory Section 80G & Form 10BD Tax Engine Workflow

```mermaid
flowchart TD
    subgraph Instant Real-Time 80G Generation
        A[Payment Marked 'Captured'] --> B[Fetch NGO 80G URN, PAN, Signatory & Donor PAN]
        B --> C[Compute Cryptographic SHA-256 Digest]
        C --> D[Generate Secure Verification QR Code]
        D --> E[Render High-Resolution PDF Certificate]
        E --> F[Store in S3 Bucket: /receipts/org_id/FY2024-25/REC-001.pdf]
        F --> G[Insert eighty_g_receipts Record]
        G --> H[Deliver PDF to Donor via WhatsApp & Email]
    end

    subgraph Annual March Form 10BD Consolidation
        I([Fiscal Year End - 31st March]) --> J[NGO Admin Clicks 'Generate Form 10BD']
        J --> K[Query all eighty_g_receipts where financial_year = '2024-2025']
        K --> L{Compliance Validation Engine}
        L --> M[Valid Records: PAN / Aadhaar Present & Validated]
        L --> N[Flagged Records: Anonymous / Missing Tax ID]
        M --> O[Generate CBDT Form 10BD Standard CSV / JSON]
        N --> P[Generate Exception Audit Report for Accountant]
        O --> Q[1-Click Upload / Export for ITD e-Filing Portal]
    end
```

### Cryptographic Receipt Verification Formula
Each 80G certificate embeds a QR code pointing to `https://ekhum.org/verify/receipt/{receipt_id}?hash={sha256_hash}`.

$$\text{Receipt Hash} = \text{SHA256}(\text{OrgURN} \parallel \text{ReceiptNo} \parallel \text{DonorPAN} \parallel \text{Amount} \parallel \text{Timestamp})$$

This prevents receipt forgery, duplicate claims, or altered amounts during tax audits.

---

## 7. Dynamic RFM Segmentation & Real-Time Contact Rollup

To enable targeted marketing without manual data wrangling, every successful gift immediately updates constituent rollups:

```mermaid
flowchart LR
    Donation([New Donation: ₹5,000]) --> RollupService[Contact Rollup Engine]
    
    RollupService --> UpdateLTV[Update total_paid_amount: LTV]
    RollupService --> UpdateCount[Increment total_gift_count_paid]
    RollupService --> UpdateLastDate[Set last_gift_date = TODAY]
    RollupService --> CalcRFM[Compute RFM Score 1-5]
    
    CalcRFM --> SegmentEval{Dynamic Segment Triggers}
    SegmentEval --> Seg1[Add to 'Major Donors > ₹10,000']
    SegmentEval --> Seg2[Remove from 'Lapsed Donors']
```

1. **Recency ($R$)**: Days since `last_gift_date` (Score 1–5).
2. **Frequency ($F$)**: Count of `total_gift_count_paid` over lifetime (Score 1–5).
3. **Monetary ($M$)**: Total value `total_paid_amount` (Score 1–5).
4. Donors with score `5-5-5` automatically enter the **VIP Major Donor Journey**, assigning a dedicated relationship manager CRM task.
