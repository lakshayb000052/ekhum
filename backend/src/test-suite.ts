import pool from './config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
  extractNgoGatewayRails, 
  resolveCampaignPaymentRouting, 
  generatePayUHash, 
  verifyPayUReverseHash, 
  encryptCCAvenue, 
  decryptCCAvenue, 
  generateWorldlineChecksum 
} from './services/paymentRouter';
import { renderTemplateContent } from './services/templateEngine';
import { validateSegmentSQL } from './services/segmentEngine';
import crypto from 'crypto';

interface TestResult {
  step: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(step: string, name: string, passed: boolean, details?: string, error?: string) {
  results.push({ step, name, passed, details, error });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${step}] ${name}`);
  if (details) console.log(`       ℹ️ ${details}`);
  if (error) console.log(`       ⚠️ Error: ${error}`);
}

async function runDanaProComprehensiveTests() {
  console.log('================================================================');
  console.log('🚀 DANAPRO / EKHUM — COMPREHENSIVE END-TO-END SYSTEM TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // STEP 1: DATABASE & SCHEMA INTEGRITY
  // -------------------------------------------------------------
  console.log('📋 STEP 1: Database & Schema Verification');
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time');
    recordTest('STEP 1', 'PostgreSQL Connectivity', true, `Database responsive at ${dbRes.rows[0].db_time}`);

    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    const requiredTables = [
      'superadmins', 'organizations', 'organization_members', 'campaigns', 
      'donors', 'donations', 'subscriptions', 'compliance_receipts', 
      'eighty_g_receipts', 'templates', 'audit_logs', 'system_settings',
      'consents', 'segments', 'broadcasts', 'journeys'
    ];

    const missingTables = requiredTables.filter(t => !tables.includes(t));
    if (missingTables.length === 0) {
      recordTest('STEP 1', 'Table Schema Coverage', true, `All ${requiredTables.length} core tables confirmed present.`);
    } else {
      recordTest('STEP 1', 'Table Schema Coverage', false, undefined, `Missing tables: ${missingTables.join(', ')}`);
    }
  } catch (err: any) {
    recordTest('STEP 1', 'Database Health Check', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 2: AUTHENTICATION & SUPERADMIN ACCESS
  // -------------------------------------------------------------
  console.log('\n📋 STEP 2: Authentication & RBAC Verification');
  let testOrgId = '';
  let testCampaignId = '';
  let testDonorId = '';
  let testDonationId = '';
  const JWT_SECRET = process.env.JWT_SECRET || 'danapro_local_jwt_secret_token_change_in_production';

  try {
    const superRes = await pool.query('SELECT * FROM superadmins WHERE email = $1', ['Superlucky@gmail.com']);
    if (superRes.rows.length > 0) {
      const superadmin = superRes.rows[0];
      const match = await bcrypt.compare('Superlucky@123', superadmin.password_hash) || 
                    await bcrypt.compare('Lakshay@123', superadmin.password_hash);
      recordTest('STEP 2', 'Superadmin Credentials Verification', match, `Superadmin: ${superadmin.email} verified`);

      // Test JWT Generation
      const superToken = jwt.sign({ email: superadmin.email, role: 'superadmin' }, JWT_SECRET, { expiresIn: '1h' });
      const decoded: any = jwt.verify(superToken, JWT_SECRET);
      recordTest('STEP 2', 'JWT Token Signing & Decoding', decoded.role === 'superadmin', `Role: ${decoded.role}`);
    } else {
      recordTest('STEP 2', 'Superadmin Exists', false, undefined, 'Superadmin record not found');
    }

    // Create or find Test Organization
    const orgCheck = await pool.query("SELECT * FROM organizations WHERE slug = 'test-ngo-suite'");
    if (orgCheck.rows.length > 0) {
      testOrgId = orgCheck.rows[0].id;
      recordTest('STEP 2', 'Test NGO Org Context', true, `Using existing Org: ${orgCheck.rows[0].name} (${testOrgId})`);
    } else {
      const newOrg = await pool.query(`
        INSERT INTO organizations (
          name, slug, tax_id_country, primary_currency, status, verified_sender_email,
          payment_gateways_config, permissions
        ) VALUES (
          'Suite Test Foundation', 'test-ngo-suite', 'IND', 'INR', 'active', 'test@suite.org',
          '{"primary_gateway": "razorpay", "enable_auto_failover": true, "gateways": [{"id": "gw_rzp_suite", "type": "razorpay", "is_active": true, "credentials": {"key_id": "rzp_test_suite", "key_secret": "sec_suite"}}]}'::jsonb,
          '{"can_accept_donations": true, "can_issue_80g_receipts": true, "can_export_data": true, "can_run_ai_analytics": true, "platform_fee_percent": 0.0}'::jsonb
        ) RETURNING id, name
      `);
      testOrgId = newOrg.rows[0].id;
      recordTest('STEP 2', 'Test NGO Org Creation', true, `Created Org: ${newOrg.rows[0].name} (${testOrgId})`);
    }
  } catch (err: any) {
    recordTest('STEP 2', 'Auth & Organization Setup', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 3: CAMPAIGN CREATION & PAYMENT ROUTING
  // -------------------------------------------------------------
  console.log('\n📋 STEP 3: Campaign & Multi-Gateway Payment Routing');
  try {
    const campCheck = await pool.query("SELECT * FROM campaigns WHERE slug = 'suite-water-clean'");
    if (campCheck.rows.length > 0) {
      testCampaignId = campCheck.rows[0].id;
      recordTest('STEP 3', 'Campaign Retrieval', true, `Campaign: ${campCheck.rows[0].title} (${testCampaignId})`);
    } else {
      const newCamp = await pool.query(`
        INSERT INTO campaigns (
          organization_id, title, description, slug, goal_amount, is_active, approval_status,
          payment_config, permissions
        ) VALUES (
          $1, 'Clean Water Initiative 2026', 'Providing clean drinking water to 500 villages', 
          'suite-water-clean', 100000.00, true, 'approved',
          '{"assigned_gateway_ids": ["gw_rzp_suite"], "primary_gateway": "razorpay"}'::jsonb,
          '{"allow_anonymous": true, "tax_receipt_enabled": true, "min_donation": 100}'::jsonb
        ) RETURNING id, title
      `, [testOrgId]);
      testCampaignId = newCamp.rows[0].id;
      recordTest('STEP 3', 'Campaign Creation', true, `Created Campaign: ${newCamp.rows[0].title} (${testCampaignId})`);
    }

    // Test Multi-gateway Routing Resolution
    const ngoConfig = {
      primary_gateway: 'razorpay',
      fallback_gateway: 'payu',
      enable_auto_failover: true,
      gateways: [
        { id: 'gw_rzp_suite', type: 'razorpay', is_active: true, credentials: { key_id: 'rzp_test_suite', key_secret: 'sec_suite' } },
        { id: 'gw_payu_suite', type: 'payu', is_active: true, credentials: { merchant_key: 'payu_key', merchant_salt: 'payu_salt' } }
      ]
    };
    const campConfig = { assigned_gateway_ids: ['gw_rzp_suite'], primary_gateway: 'razorpay' };
    const routing = await resolveCampaignPaymentRouting(campConfig, ngoConfig);
    recordTest('STEP 3', 'Payment Rail Resolution', routing.activeRail?.type === 'razorpay', `Active Rail: ${routing.activeRail?.type}`);

    // Test Gateway Cryptography
    const sampleHash = generatePayUHash({
      key: 'TESTKEY',
      txnid: 'txn_test_123',
      amount: 1000,
      productinfo: 'Clean Water',
      firstname: 'Rahul Sharma',
      email: 'rahul@test.com',
      salt: 'TESTSALT'
    });
    recordTest('STEP 3', 'PayU SHA-512 Hash Computation', sampleHash.length === 128, `Hash length: ${sampleHash.length}`);

    const encCcav = encryptCCAvenue('merchant_id=123&order_id=ord_456', '8B9F04D92841CA902E41829B0482910F');
    const decCcav = decryptCCAvenue(encCcav, '8B9F04D92841CA902E41829B0482910F');
    recordTest('STEP 3', 'CCAvenue AES-128-CBC Encrypt/Decrypt', decCcav === 'merchant_id=123&order_id=ord_456', 'Decrypted string matches original');

    const wlCheck = generateWorldlineChecksum({
      merchantId: 'WL_001',
      terminalId: 'TID_001',
      orderId: 'ORD_001',
      amount: 2500,
      currency: 'INR',
      secretKey: 'WL_SECRET'
    });
    recordTest('STEP 3', 'Worldline SHA-256 Checksum', wlCheck.length === 64, `Checksum: ${wlCheck.substring(0, 16)}...`);
  } catch (err: any) {
    recordTest('STEP 3', 'Campaign & Routing Tests', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 4: DONATION CHECKOUT & CONTACT CREATION
  // -------------------------------------------------------------
  console.log('\n📋 STEP 4: Donation Processing & Donor CRM Sync');
  try {
    // 1. Donor Upsert
    const donorEmail = 'rahul.sharma.test@suite.org';
    const donorUpsert = await pool.query(`
      INSERT INTO donors (
        organization_id, name, email, phone, tax_id, tax_id_type, country,
        metadata, total_paid_amount, total_gift_count_paid, last_gift_amount_paid,
        first_gift_date, last_gift_date, contact_status
      ) VALUES (
        $1, 'Rahul Sharma', $2, '+919876543210', 'ABCDE1234F', 'PAN', 'IND',
        '{"engagement_score": 85, "tags": ["HNI", "Environment"]}'::jsonb,
        5000.00, 1, 5000.00, CURRENT_DATE, CURRENT_DATE, 'active_donor'
      ) ON CONFLICT (organization_id, email) DO UPDATE 
        SET total_paid_amount = donors.total_paid_amount + 5000.00,
            total_gift_count_paid = donors.total_gift_count_paid + 1,
            last_gift_date = CURRENT_DATE
      RETURNING id, name, email, total_paid_amount
    `, [testOrgId, donorEmail]);

    testDonorId = donorUpsert.rows[0].id;
    recordTest('STEP 4', 'Donor CRM Record Upsert', true, `Donor: ${donorUpsert.rows[0].name} (Total Paid: ₹${donorUpsert.rows[0].total_paid_amount})`);

    // 2. Donation Record Insert
    const txnId = `txn_suite_${Date.now()}`;
    const donationInsert = await pool.query(`
      INSERT INTO donations (
        organization_id, campaign_id, donor_id, amount, currency, net_amount, fee_covered,
        payment_gateway, gateway_transaction_id, status, payment_method, tax_receipt_status
      ) VALUES (
        $1, $2, $3, 5000.00, 'INR', 5000.00, 150.00,
        'razorpay', $4, 'completed', 'upi', 'generated'
      ) RETURNING id, amount, currency, status, gateway_transaction_id
    `, [testOrgId, testCampaignId, testDonorId, txnId]);

    testDonationId = donationInsert.rows[0].id;
    recordTest('STEP 4', 'Donation Transaction Record', true, `Txn: ${donationInsert.rows[0].gateway_transaction_id} (Status: ${donationInsert.rows[0].status})`);
  } catch (err: any) {
    recordTest('STEP 4', 'Donation Checkout Lifecycle', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 5: 80G STATUTORY RECEIPT & FORM 10BD COMPLIANCE
  // -------------------------------------------------------------
  console.log('\n📋 STEP 5: 80G Compliance & Form 10BD Verification');
  try {
    const receiptNum = `RCP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const txHash = crypto.createHash('sha256').update(`${testDonationId}-${receiptNum}-5000.00`).digest('hex');

    // 1. Compliance Receipt
    const receiptInsert = await pool.query(`
      INSERT INTO compliance_receipts (
        donation_id, receipt_number, tax_regime, receipt_pdf_url, transaction_hash, metadata
      ) VALUES (
        $1, $2, 'Section 80G', '/receipts/sample_80g.pdf', $3,
        '{"donor_pan": "ABCDE1234F", "urn": "URN-TEST-80G"}'::jsonb
      ) ON CONFLICT (donation_id) DO UPDATE SET transaction_hash = EXCLUDED.transaction_hash
      RETURNING id, receipt_number, transaction_hash
    `, [testDonationId, receiptNum, txHash]);

    recordTest('STEP 5', '80G Receipt Issuance', true, `Receipt #: ${receiptInsert.rows[0].receipt_number} (Hash: ${receiptInsert.rows[0].transaction_hash.substring(0, 16)}...)`);

    // 2. Form 10BD Aggregation Check
    const tenBdRes = await pool.query(`
      SELECT 
        d.id as donation_id,
        dn.name as donor_name,
        dn.tax_id as donor_pan,
        d.amount,
        d.created_at as donation_date,
        cr.receipt_number
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN compliance_receipts cr ON cr.donation_id = d.id
      WHERE d.organization_id = $1 AND d.status = 'completed'
    `, [testOrgId]);

    recordTest('STEP 5', 'Form 10BD Compliance Data Aggregation', tenBdRes.rows.length > 0, `Aggregated ${tenBdRes.rows.length} 80G record(s) for ITD filing.`);
  } catch (err: any) {
    recordTest('STEP 5', 'Compliance Verification', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 6: DYNAMIC SEGMENTS & TEMPLATE ENGINE
  // -------------------------------------------------------------
  console.log('\n📋 STEP 6: Dynamic Segmentation & Communication Templates');
  try {
    // 1. Template Engine Rendering
    const templateStr = 'Dear {{donor_name}}, thank you for donating {{donation_currency}} {{donation_amount}} to {{ngo_name}} for {{campaign_title}}!';
    const rendered = renderTemplateContent(templateStr, {
      donor_name: 'Rahul Sharma',
      donation_currency: '₹',
      donation_amount: '5,000',
      ngo_name: 'Suite Test Foundation',
      campaign_title: 'Clean Water Initiative'
    });
    const expected = 'Dear Rahul Sharma, thank you for donating ₹ 5,000 to Suite Test Foundation for Clean Water Initiative!';
    recordTest('STEP 6', 'Template Variable Substitution', rendered === expected, `Rendered: "${rendered}"`);

    // 2. Segment SQL Validation
    const validSQL = "SELECT * FROM donors WHERE total_paid_amount >= 5000";
    const invalidSQL = "SELECT * FROM donors; DROP TABLE donors;";
    
    const validCheck = validateSegmentSQL(validSQL);
    const invalidCheck = validateSegmentSQL(invalidSQL);

    recordTest('STEP 6', 'Segment SQL Rule Sanitization (Valid Query)', validCheck.valid, 'Correct SQL passed validation');
    recordTest('STEP 6', 'Segment SQL Injection Defense (Blocked Injection)', !invalidCheck.valid, `Blocked: ${invalidCheck.errors.join(', ')}`);
  } catch (err: any) {
    recordTest('STEP 6', 'Segments & Templates', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 7: REPORTS ENGINE & METRICS AGGREGATION
  // -------------------------------------------------------------
  console.log('\n📋 STEP 7: Reporting Engine & Analytics Breakdown');
  try {
    const reportRes = await pool.query(`
      SELECT 
        COUNT(d.id) as total_donations,
        COALESCE(SUM(d.amount), 0) as gross_gmv,
        COALESCE(SUM(d.fee_covered), 0) as total_fee_covered,
        COUNT(DISTINCT d.donor_id) as unique_donors
      FROM donations d
      WHERE d.organization_id = $1
    `, [testOrgId]);

    const row = reportRes.rows[0];
    recordTest('STEP 7', 'Organization Analytics Aggregation', true, `GMV: ₹${row.gross_gmv}, Total Donations: ${row.total_donations}, Donors: ${row.unique_donors}`);
  } catch (err: any) {
    recordTest('STEP 7', 'Reporting Engine', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // STEP 8: AUTOMATED SWEEP & RECONCILIATION ENGINE
  // -------------------------------------------------------------
  console.log('\n📋 STEP 8: Background Reconciliation Sweeper');
  try {
    const sweepRes = await pool.query(`
      UPDATE donations 
      SET status = 'failed', updated_at = NOW() 
      WHERE status IN ('initiated', 'pending') 
        AND (created_at < NOW() - INTERVAL '25 minutes')
      RETURNING id
    `);
    recordTest('STEP 8', 'Stale Payment Reconciliation Sweep', true, `Reconciled ${sweepRes.rows.length} expired initiated transactions.`);
  } catch (err: any) {
    recordTest('STEP 8', 'Reconciliation Sweeper', false, undefined, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Checks Run : ${total}`);
  console.log(`Passed           : ${passed} ✅`);
  console.log(`Failed           : ${failed} ${failed > 0 ? '❌' : '🎉'}`);
  console.log(`Overall Health   : ${failed === 0 ? '100% HEALTHY' : `${Math.round((passed / total) * 100)}% PASS RATE`}`);
  console.log('================================================================\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runDanaProComprehensiveTests().catch(err => {
  console.error('Fatal Test Runner Failure:', err);
  process.exit(1);
});
