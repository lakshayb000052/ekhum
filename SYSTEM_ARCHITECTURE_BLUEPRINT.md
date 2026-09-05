# EKhum (DanaPro / Philanthropy OS) — Master Engineering & Architecture Blueprint

---

## 🏛️ System Architecture & Engineering Documentation Suite

This repository contains the complete engineering specification, data model, workflow orchestration, software architecture, API contracts, and cybersecurity defense model for **EKhum (DanaPro / Philanthropy OS)** — the enterprise operating system for global philanthropy, individual giving, child sponsorship, and Indian statutory tax compliance (Section 80G & Form 10BD).

---

## 📑 Core Documentation Index

| Document | Primary Focus | Key Contents |
|---|---|---|
| **[`docs/COMPLETE_SYSTEM_DIAGRAMS_AND_SECURITY_GUIDE.md`](file:///e:/DanaPro/docs/COMPLETE_SYSTEM_DIAGRAMS_AND_SECURITY_GUIDE.md)** | **Master Diagrams & Security Guide** | • Full Visual ERDs & System Topologies<br/>• Complete GitHub Documentation Index<br/>• Step-by-Step Data Encryption & Security Setup |
| **[`docs/DATA_MODEL.md`](file:///e:/DanaPro/docs/DATA_MODEL.md)** | **Complete Data Architecture** | • 22+ PostgreSQL Tables & Schema Definitions<br/>• Entity Relationship Diagram (ERD)<br/>• JSONB Dynamic Schemas & GIN Indexing<br/>• DPDP Act 2023 Field Encryption & Blind Indexing |
| **[`docs/WORKFLOW_ENGINEERING.md`](file:///e:/DanaPro/docs/WORKFLOW_ENGINEERING.md)** | **Business Logic & Lifecycles** | • End-to-End Donor Checkout Flow<br/>• 4-Way Payment Rail Failover Logic<br/>• 11-Trigger Reactive Event Bus<br/>• Visual Journey Graph Traversal Engine<br/>• Anti-Churn Sponsorship Recovery Workflow<br/>• Section 80G & Form 10BD Statutory Tax Flow |
| **[`docs/ARCHITECTURE_OVERVIEW.md`](file:///e:/DanaPro/docs/ARCHITECTURE_OVERVIEW.md)** | **Software Architecture Design** | • C4 Model (Context, Container, Component, Code)<br/>• Frontend Architecture (React 18, Vite, TS, Tailwind)<br/>• Modular Backend Microservices & Sidecars<br/>• Parametric Multi-Tenancy Strategy<br/>• Full Technology Stack Matrix |
| **[`docs/SECURITY_AND_THREAT_MODEL.md`](file:///e:/DanaPro/docs/SECURITY_AND_THREAT_MODEL.md)** | **Cybersecurity & Threat Defense** | • 7-Layer Defense-in-Depth Architecture<br/>• Anti-Data Breach Controls (AES-256-GCM, Blind Index)<br/>• Anti-Server Breach & Hardening (Cloudflare WAF, Non-Root)<br/>• Webhook HMAC Verification & Anti-SSRF Guard<br/>• DPDP Act 2023 Verifiable Consent Registry<br/>• Immutable `audit_logs` & Anomaly Alerts<br/>• Disaster Recovery & Incident Response (RPO < 5m, RTO < 30m) |
| **[`docs/DATA_ENCRYPTION_AND_SECURITY.md`](file:///e:/DanaPro/docs/DATA_ENCRYPTION_AND_SECURITY.md)** | **Data Encryption Setup Guide** | • Zero-Trust AES-256-GCM Field-Level Encryption<br/>• Deterministic Blind Indexing (HMAC-SHA256)<br/>• PII Masking Engine (PAN, Phone, Email)<br/>• Production Key Generation & Environment Setup |
| **[`docs/API_SPECIFICATION.md`](file:///e:/DanaPro/docs/API_SPECIFICATION.md)** | **API Contracts & Integrations** | • Public Checkout & Giving Endpoints<br/>• CRM, Campaigns & Compliance REST Endpoints<br/>• Webhook Ingress/Egress (Razorpay, PayU, Meta WABA)<br/>• Idempotency Header Standard & Error Taxonomy |
| **[`docs/DEPLOYMENT_AND_INFRASTRUCTURE.md`](file:///e:/DanaPro/docs/DEPLOYMENT_AND_INFRASTRUCTURE.md)** | **Cloud & DevOps Topography** | • VPC Private Subnet Topography<br/>• Hardened Multi-Stage Dockerfile<br/>• PgBouncer Connection Pooling (5,000+ Concurrency)<br/>• Zero-Downtime CI/CD Rolling Deployment Pipeline |

---

## ⚡ High-Level System Architecture Summary

```
                              ┌────────────────────────────────────────────────────────┐
                              │               CLOUDFLARE EDGE & WAF                    │
                              │  (DDoS Shield, Bot Defense, TLS 1.3, Rate Limiting)    │
                              └──────────────────────────┬─────────────────────────────┘
                                                         │
                                                         ▼
                              ┌────────────────────────────────────────────────────────┐
                              │             NGINX REVERSE PROXY / INGRESS              │
                              └──────────────┬───────────────────────────┬─────────────┘
                                             │                           │
                    ┌────────────────────────┴─────────┐       ┌─────────┴───────────────┐
                    ▼                                  ▼       ▼                         ▼
        ┌───────────────────────┐            ┌───────────────────┐             ┌───────────────────┐
        │   DONOR CHECKOUT UI   │            │ NODE.JS / EXPRESS │             │ GO WHATSAPP ENGINE│
        │ (React 18 / Vite / TS)│            │    API GATEWAY    │             │  (Baileys Sidecar)│
        └───────────────────────┘            └─────────┬─────────┘             └───────────────────┘
                                                       │
             ┌─────────────────────────┬───────────────┴───────────────┬────────────────────────────┐
             ▼                         ▼                               ▼                            ▼
   ┌──────────────────┐      ┌──────────────────┐            ┌──────────────────┐         ┌──────────────────┐
   │ MULTI-GATEWAY    │      │ REAL-TIME EVENT  │            │ VISUAL JOURNEY   │         │ STATUTORY 80G &  │
   │ ROUTER & NORMAL. │      │ BUS (11 EVENTS)  │            │ BUILDER ENGINE   │         │ FORM 10BD ENGINE │
   │(4-Way Failover)  │      └────────┬─────────┘            └────────┬─────────┘         └────────┬─────────┘
   └─────────┬────────┘               │                               │                            │
             │                        ▼                               ▼                            ▼
             │               ┌───────────────────────────────────────────────────────────────────────────┐
             │               │                   POSTGRESQL 15 + PGBOUNCER POOLING                       │
             │               │    (Parametric Multi-Tenancy, AES-256-GCM Encrypted PANs, Immutable Logs) │
             │               └───────────────────────────────────────────────────────────────────────────┘
             │                                                         │
             ▼                                                         ▼
   ┌──────────────────┐                                      ┌──────────────────┐
   │ EXTERNAL RAILS   │                                      │ REDIS 7 CLUSTER  │
   │Razorpay / PayU / │                                      │ (Token Bucket &  │
   │CCAvenue / Cashfree                                      │  Pub/Sub Queue)  │
   └──────────────────┘                                      └──────────────────┘
```

---

## 🛡️ Key Security Features Summary

1. **Anti-Data Breach Safeguards**:
   - **Zero Plaintext Sensitive PII**: PAN, Aadhaar, and bank account numbers are encrypted application-side using **AES-256-GCM**.
   - **HMAC-SHA256 Blind Indexing**: Allows exact-match lookups during checkout without decrypting the dataset.
   - **Parametric Tenant Scoping**: Hardened middleware enforces `WHERE organization_id = $1` on every query, completely blocking cross-tenant Insecure Direct Object References (IDOR).
   - **DPDP Act 2023 Consent Registry**: Verifiable audit records with IP, timestamp, and terms version for every donor opt-in.

2. **Anti-Server Breach Safeguards**:
   - **Cloudflare Edge WAF & DDoS Scrubbing**: Layer 3/4/7 threat defense and IP reputation filtering.
   - **Zero Public DB/Redis Surface**: Database and cache clusters live strictly in private VPC subnets with zero public IPv4 addresses.
   - **Non-Root Read-Only Containers**: Production Docker containers execute as an unprivileged user with read-only root filesystems.
   - **Anti-SSRF & Webhook HMAC Verification**: Outbound webhooks strictly block private RFC-1918 subnets and cloud metadata IPs (`169.254.169.254`); incoming webhooks verify cryptographic signatures.
   - **Immutable Audit Trails**: All administrative exports, logins, and permission changes are recorded in append-only `audit_logs` with real-time anomaly alerts.
