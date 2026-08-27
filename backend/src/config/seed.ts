import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export default async function runSeed(pool: Pool): Promise<void> {
  try {
    console.log('🌱 Checking and auto-seeding core platform data...');

    // 1. Superadmin User
    const passHash = await bcrypt.hash('Superlucky@123', 10);
    await pool.query(`
      INSERT INTO superadmins (email, password_hash)
      VALUES ('Superlucky@gmail.com', $1)
      ON CONFLICT (email) DO NOTHING
    `, [passHash]);

    // 2. Default Test NGO Organization
    const defaultOrgId = '88de24ec-6160-408c-a69b-692a3894bafd';
    await pool.query(`
      INSERT INTO organizations (
        id, name, slug, legal_name, tax_id_country, primary_currency, 
        eighty_g_urn, signatory_name, signatory_designation, status,
        permissions, tax_compliance_config, payment_gateways_config
      )
      VALUES (
        $1, 'Child Help Foundation', 'test', 'Child Help Foundation Trust', 'IN', 'INR',
        'AAATC1234F2180G1', 'Lakshay Batra', 'Trustee & Compliance Officer', 'active',
        '{"can_accept_donations": true, "can_issue_80g_receipts": true, "can_export_data": true, "can_run_ai_analytics": true, "platform_fee_percent": 0.0}'::jsonb,
        '{"eighty_g_enabled": true, "ten_bd_filing": true}'::jsonb,
        '{"razorpay": {"enabled": true}, "cashfree": {"enabled": true}}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        status = 'active'
    `, [defaultOrgId]);

    // 3. Default NGO Admin Member (test@gmail.com / Lakshay@123)
    const ngoPassHash = await bcrypt.hash('Lakshay@123', 10);
    await pool.query(`
      INSERT INTO organization_members (organization_id, email, password_hash, role)
      VALUES ($1, 'test@gmail.com', $2, 'admin')
      ON CONFLICT (organization_id, email) DO UPDATE SET password_hash = $2
    `, [defaultOrgId, ngoPassHash]);

    // 4. Default Campaigns
    const testCampId = '550e8400-e29b-41d4-a716-446655440000';
    await pool.query(`
      INSERT INTO campaigns (
        id, organization_id, title, description, slug, api_key, 
        landing_page_url, is_active, approval_status, goal_amount,
        payment_config, permissions
      )
      VALUES (
        $1, $2, 'Test_campaigns', 'Clean Water & Nutrition Initiative 2026', 'test_campaigns', 'wg_live_test_campaigns_key_123',
        '/test_campaigns', true, 'approved', 500000,
        '{"gateways": ["razorpay", "cashfree"]}'::jsonb,
        '{"allow_anonymous": true, "tax_receipt_enabled": true, "min_donation": 1}'::jsonb
      )
      ON CONFLICT (slug) DO UPDATE SET
        api_key = 'wg_live_test_campaigns_key_123',
        is_active = true,
        approval_status = 'approved'
    `, [testCampId, defaultOrgId]);

    // FinMantra Campaign
    await pool.query(`
      INSERT INTO campaigns (
        organization_id, title, description, slug, api_key,
        landing_page_url, is_active, approval_status, goal_amount
      )
      VALUES (
        $1, 'FinMantra Empowerment Campaign 2026', 'Official FinMantra NGO Campaign for Financial Empowerment', 'finmantra_campaign', 'dp_live_1a4f11d71db045bb16af1f7d9318a7a4',
        'http://localhost:8000', true, 'approved', 500000
      )
      ON CONFLICT (slug) DO UPDATE SET
        api_key = 'dp_live_1a4f11d71db045bb16af1f7d9318a7a4',
        is_active = true,
        approval_status = 'approved'
    `, [defaultOrgId]);

    // 5. Default Automated Journey & Steps
    const journeyRes = await pool.query(`
      INSERT INTO journeys (
        organization_id, name, description, trigger_type, status
      )
      VALUES (
        $1, 'Donor Success & 80G Tax Receipt Journey', 'Automated instant WhatsApp alert and 80G tax receipt email dispatch upon donation', 'donation.completed', 'published'
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [defaultOrgId]);

    const journeyId = journeyRes.rows[0]?.id;
    if (journeyId) {
      await pool.query(`
        INSERT INTO journey_steps (
          journey_id, step_order, step_type, config
        )
        VALUES (
          $1, 1, 'send_whatsapp', '{"template_type": "whatsapp_success", "delay_minutes": 0}'::jsonb
        )
      `, [journeyId]);

      await pool.query(`
        INSERT INTO journey_steps (
          journey_id, step_order, step_type, config
        )
        VALUES (
          $1, 2, 'send_email', '{"template_type": "email_success", "delay_minutes": 0}'::jsonb
        )
      `, [journeyId]);
    }

    // 6. System Settings
    const defaultSettings: [string, string][] = [
      ['AWS_ACCESS_KEY_ID', process.env.AWS_ACCESS_KEY_ID || ''],
      ['AWS_SECRET_ACCESS_KEY', process.env.AWS_SECRET_ACCESS_KEY || ''],
      ['AWS_REGION', process.env.AWS_REGION || 'ap-south-1'],
      ['AWS_SES_FROM_EMAIL', process.env.AWS_SES_FROM_EMAIL || 'lakshayb057@gmail.com'],
      ['SMTP_HOST', process.env.SMTP_HOST || 'smtp.gmail.com'],
      ['SMTP_PORT', process.env.SMTP_PORT || '465'],
      ['SMTP_USER', process.env.SMTP_USER || ''],
      ['SMTP_PASS', process.env.SMTP_PASS || ''],
      ['OPENAI_API_KEY', process.env.OPENAI_API_KEY || ''],
      ['GEMINI_API_KEY', process.env.GEMINI_API_KEY || ''],
      ['RAZORPAY_KEY_ID', process.env.RAZORPAY_KEY_ID || '']
    ];

    for (const [key, value] of defaultSettings) {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2
      `, [key, value]);
    }

    console.log('✅ Core platform data, API keys, campaigns, and journey workflows auto-seeded successfully!');
  } catch (err: any) {
    console.error('⚠️ [Seed Error]:', err.message);
  }
}
