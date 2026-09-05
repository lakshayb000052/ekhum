import crypto from 'crypto';

/**
 * Enterprise Cryptographic Service for EKhum / DanaPro
 * Implements Zero-Trust AES-256-GCM Field-Level Encryption, Blind Indexing, and PII Masking
 * Aligned with DPDP Act 2023 & PCI-DSS standards.
 */

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const BLIND_INDEX_ALGORITHM = 'sha256';

// Derive or load master encryption keys from environment
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!envKey) {
    // For development fallback: derive deterministic key with warning
    console.warn('⚠️ [SECURITY WARNING]: ENCRYPTION_MASTER_KEY not set. Using dev fallback key. Set a 32-byte hex/base64 key in production!');
    return crypto.scryptSync('ekhum-dev-master-secret-salt-2024', 'ekhum-salt-v1', 32);
  }
  
  if (envKey.length === 64) {
    // 32-byte hex string
    return Buffer.from(envKey, 'hex');
  } else if (envKey.length === 44) {
    // 32-byte base64 string
    return Buffer.from(envKey, 'base64');
  } else {
    // Derive 32 bytes using SHA-256 if arbitrary passphrase provided
    return crypto.createHash('sha256').update(envKey).digest();
  }
}

function getBlindIndexKey(): Buffer {
  const envKey = process.env.BLIND_INDEX_KEY || process.env.ENCRYPTION_MASTER_KEY || 'ekhum-blind-index-default-salt';
  return crypto.createHash('sha256').update(`bindex-${envKey}`).digest();
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 ciphertext
  iv: string;         // Base64 12-byte IV
  tag: string;        // Base64 16-byte Auth Tag
  version: string;    // Key version for rotation
}

export class EncryptionService {
  private static masterKey: Buffer = getMasterKey();
  private static blindIndexKey: Buffer = getBlindIndexKey();
  private static keyVersion: string = 'v1';

  /**
   * Encrypts plaintext string using AES-256-GCM
   * Returns packed format: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
   */
  public static encrypt(plaintext: string): string {
    if (!plaintext || typeof plaintext !== 'string') {
      return plaintext;
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      const tag = cipher.getAuthTag();

      // Return compact serialization format
      return `enc:${this.keyVersion}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext}`;
    } catch (err) {
      console.error('Field encryption failed:', err);
      throw new Error('Encryption failed. Unable to secure sensitive data.');
    }
  }

  /**
   * Decrypts an AES-256-GCM serialized string
   * Handles format: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
   */
  public static decrypt(encryptedValue: string): string {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }

    // If not in encrypted format, return as-is (graceful migration/backwards compatibility)
    if (!encryptedValue.startsWith('enc:')) {
      return encryptedValue;
    }

    try {
      const parts = encryptedValue.split(':');
      if (parts.length !== 5) {
        throw new Error('Invalid encrypted envelope structure');
      }

      const [, version, ivB64, tagB64, ciphertextB64] = parts;
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      console.error('Field decryption failed or authentication tag mismatch:', err);
      throw new Error('Decryption failed. Data may be tampered or master key mismatched.');
    }
  }

  /**
   * Generates a deterministic HMAC-SHA256 Blind Index
   * Allows fast exact-match DB searches (e.g. searching by PAN) without decrypting records
   */
  public static generateBlindIndex(value: string): string {
    if (!value || typeof value !== 'string') return '';
    
    // Normalize input (trim whitespace, uppercase)
    const normalized = value.trim().toUpperCase();
    return crypto
      .createHmac(BLIND_INDEX_ALGORITHM, this.blindIndexKey)
      .update(normalized)
      .digest('hex');
  }

  /**
   * Masks Indian PAN card for safe display: ABCDE1234F -> ABC****34F
   */
  public static maskPAN(pan: string | null | undefined): string {
    if (!pan) return '';
    const clean = pan.trim().toUpperCase();
    if (clean.length !== 10) return clean;
    return `${clean.substring(0, 3)}****${clean.substring(7)}`;
  }

  /**
   * Masks Phone Number for display: +919876543210 -> +91 98*** **210
   */
  public static maskPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    const clean = phone.trim();
    if (clean.length < 8) return '********';
    return `${clean.substring(0, 5)}****${clean.substring(clean.length - 3)}`;
  }

  /**
   * Masks Email Address for display: aarav.sharma@example.com -> a***a@example.com
   */
  public static maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) return email || '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
  }

  /**
   * Masks Bank Account Number: 123456789012 -> ********9012
   */
  public static maskBankAccount(account: string | null | undefined): string {
    if (!account) return '';
    const clean = account.trim();
    if (clean.length <= 4) return clean;
    return `${'*'.repeat(clean.length - 4)}${clean.substring(clean.length - 4)}`;
  }

  /**
   * Generates a secure random 32-byte master key in hex (Utility for onboarding)
   */
  public static generateNewMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export default EncryptionService;
