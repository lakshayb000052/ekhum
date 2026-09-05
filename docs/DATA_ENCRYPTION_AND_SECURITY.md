# EKhum (DanaPro / Philanthropy OS) — Data Encryption & Security Setup Guide

---

## 1. Cryptographic Security Architecture

EKhum implements a **Zero-Trust Field-Level Encryption & Blind Indexing** architecture to secure sensitive donor PII, Indian Income Tax identifiers (PAN, Aadhaar), and bank account details against unauthorized access and database breaches.

```mermaid
graph TD
    subgraph 1. Ingestion Phase
        RawData["Plaintext PAN (e.g. 'ABCDE1234F')"]
    end

    subgraph 2. Application Cryptographic Tier
        KMS["Master Key (32-byte AES-256)"]
        AES["AES-256-GCM Cipher + Random 12-byte IV"]
        BIndex["HMAC-SHA256 Blind Index Key"]
        Masker["PII Masking Engine"]
    end

    subgraph 3. Storage Tier (PostgreSQL)
        EncField["tax_id: 'enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>'"]
        IndexField["tax_id_bindex: '8f4a2b9c...' (Exact-Match Search Index)"]
        MaskedField["tax_id_masked: 'ABC****34F' (Safe UI Display)"]
    end

    RawData --> AES
    KMS --> AES
    AES --> EncField

    RawData --> BIndex
    BIndex --> IndexField

    RawData --> Masker
    Masker --> MaskedField
```

---

## 2. Core Cryptographic Components

### 2.1 AES-256-GCM Envelope Encryption (`EncryptionService.encrypt`)
- **Algorithm**: `aes-256-gcm` (Galois/Counter Mode).
- **Initialization Vector (IV)**: Unique 12-byte (96-bit) cryptographically random IV per encryption operation.
- **Authentication Tag**: 16-byte (128-bit) integrity authentication tag to detect any tampering.
- **Serialized Envelope Format**:
  ```
  enc:<key_version>:<iv_base64>:<auth_tag_base64>:<ciphertext_base64>
  ```
- **Benefit**: Even if two donors have the same PAN or bank account, their encrypted ciphertexts will look completely different due to the unique random IV.

### 2.2 Deterministic Blind Indexing (`EncryptionService.generateBlindIndex`)
- **Algorithm**: `HMAC-SHA256` using an independent blind index salt key.
- **Purpose**: Enables high-speed, exact-match database queries (`WHERE tax_id_bindex = $1`) without decrypting database columns or exposing raw PAN numbers in database indexes.

### 2.3 PII Masking Utilities
- **PAN**: `ABCDE1234F` $\rightarrow$ `ABC****34F`
- **Phone**: `+919876543210` $\rightarrow$ `+91 98*** **210`
- **Email**: `aarav.sharma@example.com` $\rightarrow$ `a***a@example.com`
- **Bank Account**: `123456789012` $\rightarrow$ `********9012`

---

## 3. How to Configure Encryption Keys in Production

### Step 1: Generate Master Cryptographic Keys
Run the helper function in Node.js or run OpenSSL to generate 32-byte hex keys:

```bash
# Generate 32-byte (256-bit) AES Master Encryption Key
openssl rand -hex 32

# Generate 32-byte HMAC Blind Index Salt Key
openssl rand -hex 32
```

### Step 2: Add Keys to Environment Variables (`.env`)
Add the generated keys to your production environment variables (e.g. on Render, AWS Secrets Manager, or `.env`):

```ini
# Production Master AES-256-GCM Encryption Key (64 hex characters)
ENCRYPTION_MASTER_KEY=a7d2f8e1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0

# Blind Index Key for Searchable Hash Lookups
BLIND_INDEX_KEY=9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e

# JWT Token Signing Secret
JWT_SECRET=super-secure-production-jwt-token-secret-key-512-bit

# Webhook HMAC Signing Secret
WEBHOOK_SECRET=whsec_ekhum_production_secure_gateway_key_99
```

---

## 4. Code Implementation Reference

The cryptographic service is fully implemented in:
- **Service**: [`backend/src/services/encryptionService.ts`](file:///e:/DanaPro/backend/src/services/encryptionService.ts)
- **Security Middleware**: [`backend/src/middleware/security.ts`](file:///e:/DanaPro/backend/src/middleware/security.ts)

### Usage Example: Encrypting and Decrypting Donor Data

```typescript
import { EncryptionService } from '../services/encryptionService';

// 1. Storing a Donor with Encrypted PAN and Blind Index
const rawPAN = 'ABCPS1234F';
const encryptedPAN = EncryptionService.encrypt(rawPAN);
const panBlindIndex = EncryptionService.generateBlindIndex(rawPAN);
const maskedPAN = EncryptionService.maskPAN(rawPAN);

await pool.query(
  `INSERT INTO donors (organization_id, name, email, tax_id, tax_id_bindex, tax_id_masked)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [orgId, 'Aarav Sharma', 'aarav@example.com', encryptedPAN, panBlindIndex, maskedPAN]
);

// 2. Querying Donor by PAN without Decrypting
const searchPAN = 'ABCPS1234F';
const searchIndex = EncryptionService.generateBlindIndex(searchPAN);

const result = await pool.query(
  `SELECT * FROM donors WHERE organization_id = $1 AND tax_id_bindex = $2`,
  [orgId, searchIndex]
);

// 3. Decrypting PAN when Generating Statutory 80G Receipt
const decryptedPAN = EncryptionService.decrypt(result.rows[0].tax_id);
```

---

## 5. Security Checklist & Verification

| Security Domain | Implemented Control | Status |
|---|---|---|
| **Data at Rest** | AES-256-GCM Field-Level Encryption for PAN, Bank Accounts, PII | ✅ Active |
| **Data in Transit** | TLS 1.3 + HSTS (`max-age=31536000; includeSubDomains; preload`) | ✅ Active |
| **Searchable Crypto** | HMAC-SHA256 Blind Indexing without database decryption | ✅ Active |
| **Defense Headers** | Content-Security-Policy, X-Frame-Options, X-Content-Type-Options | ✅ Active |
| **Anti-SSRF Guard** | Blocks loopback (`127.0.0.1`), RFC-1918 private IPs, and cloud metadata (`169.254.169.254`) | ✅ Active |
| **Webhook Security** | Timing-safe HMAC-SHA256 cryptographic signature verification | ✅ Active |
| **Audit Trails** | Append-only `audit_logs` capturing user, action, IP, and timestamp | ✅ Active |
| **Multi-Tenancy** | Parametric scoping (`WHERE organization_id = $1`) preventing IDOR leaks | ✅ Active |
