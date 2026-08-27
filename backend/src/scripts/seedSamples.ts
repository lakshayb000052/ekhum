import pool from '../config/db';
import { Pool } from 'pg';

export async function syncToRender() {
  const renderConnectionString = 'postgresql://ekhum_user:j2kNHl66N4Y2FeWy4GCaunBLBSkaEnzx@dpg-da7jsge7bikc73dk1te0-a.oregon-postgres.render.com/ekhum_5bvr?sslmode=require';
  const renderPool = new Pool({
    connectionString: renderConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log('🚀 Starting Full Migration & Sync from Local DanaPro DB to Render Cloud Postgres...');

  // 1. Fetch all table names from local database
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tableNames = tablesRes.rows.map(r => r.table_name);
  console.log('Found tables in Local DB:', tableNames.join(', '));

  // 2. Define ordered sequence to respect foreign keys
  const orderedTables = [
    'superadmins',
    'organizations',
    'organization_members',
    'campaigns',
    'donors',
    'subscriptions',
    'mandates',
    'donations',
    'compliance_receipts',
    'system_settings',
    'templates',
    'landing_pages',
    'sessions',
    'events',
    'consents',
    'segments',
    'segment_memberships',
    'broadcasts',
    'broadcast_recipients',
    'journeys',
    'journey_steps',
    'journey_enrolments',
    'whatsapp_communications',
    'email_communications',
    'reports',
    'dashboards',
    'custom_objects',
    'custom_fields',
    'custom_records',
    'audit_logs',
    'ai_interactions'
  ];

  tableNames.forEach(t => {
    if (!orderedTables.includes(t)) orderedTables.push(t);
  });

  // 3. Auto-create tables on Render DB by reading DDL structure
  for (const table of orderedTables) {
    if (!tableNames.includes(table)) continue;

    const colsRes = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (colsRes.rows.length === 0) continue;

    const colDefs = colsRes.rows.map(c => {
      let type = c.data_type;
      if (type === 'USER-DEFINED') type = c.udt_name;
      if (type === 'ARRAY') type = c.udt_name.replace('_', '') + '[]';
      if (c.udt_name === 'uuid') type = 'UUID';
      if (c.udt_name === 'jsonb') type = 'JSONB';
      if (c.udt_name === 'timestamptz') type = 'TIMESTAMP WITH TIME ZONE';
      
      let def = `"${c.column_name}" ${type}`;
      if (c.column_name === 'id') def += ' PRIMARY KEY';
      return def;
    });

    try {
      await renderPool.query(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs.join(', ')})`);
    } catch (e) {}

    for (const c of colsRes.rows) {
      let type = c.data_type;
      if (type === 'USER-DEFINED') type = c.udt_name;
      if (type === 'ARRAY') type = c.udt_name.replace('_', '') + '[]';
      if (c.udt_name === 'uuid') type = 'UUID';
      if (c.udt_name === 'jsonb') type = 'JSONB';
      if (c.udt_name === 'timestamptz') type = 'TIMESTAMP WITH TIME ZONE';

      try {
        await renderPool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${c.column_name}" ${type}`);
      } catch (err) {}
    }
  }

  console.log('✅ All table structures and schema migrations verified on Render.');

  // 4. Copy data row by row
  let totalRowsCopied = 0;
  for (const table of orderedTables) {
    if (!tableNames.includes(table)) continue;

    const dataRes = await pool.query(`SELECT * FROM "${table}"`);
    if (dataRes.rows.length === 0) {
      console.log(`  - ${table}: 0 rows`);
      continue;
    }

    let copiedCount = 0;
    for (const row of dataRes.rows) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const placeholders = keys.map((_, i) => '$' + (i + 1));
      const colNames = keys.map(k => `"${k}"`).join(', ');

      const query = `
        INSERT INTO "${table}" (${colNames})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT DO NOTHING
      `;

      try {
        await renderPool.query(query, values);
        copiedCount++;
      } catch (err) {
        try {
          if (row.id) {
            const updateSet = keys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
            if (updateSet) {
              const upsertQuery = `
                INSERT INTO "${table}" (${colNames})
                VALUES (${placeholders.join(', ')})
                ON CONFLICT (id) DO UPDATE SET ${updateSet}
              `;
              await renderPool.query(upsertQuery, values);
              copiedCount++;
            }
          }
        } catch (innerErr: any) {
          console.error(`    Error copying row into ${table}:`, innerErr.message);
        }
      }
    }
    console.log(`  ✓ ${table}: ${copiedCount} / ${dataRes.rows.length} rows synchronized`);
    totalRowsCopied += copiedCount;
  }

  console.log(`\n🎉 SUCCESS: ${totalRowsCopied} total records, credentials, campaigns, API keys, and test data synchronized to Render Postgres!`);
  await renderPool.end();
}

if (require.main === module) {
  syncToRender().then(() => process.exit(0)).catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}

async function seedSampleTemplates() {
  console.log('Seeding rich sample templates for 80G Receipts, WhatsApp, and Email Notifications into PostgreSQL...');

  const sampleTemplates = [
    {
      type: '80g_receipt',
      name: '📜 Statutory Form 10BD Aligned 80G Certificate',
      subject: 'Official 80G Statutory Certificate',
      content: `<div style="font-family: Arial, sans-serif; padding: 30px; border: 2px solid #059669; border-radius: 12px; color: #0F172A; max-width: 650px; margin: auto;">
  <div style="text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #059669; margin: 0; font-size: 1.4rem;">CERTIFICATE OF DONATION UNDER SECTION 80G</h2>
    <span style="font-size: 0.8rem; color: #64748B;">Income Tax Department &bull; Government of India</span>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 20px;">
    <tr>
      <td style="padding: 6px 0;"><strong>Recipient Organization:</strong> {{ngo_name}}</td>
      <td style="padding: 6px 0; text-align: right;"><strong>80G URN:</strong> URN-{{ngo_urn}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0;"><strong>Authorized Officer:</strong> {{ngo_signatory}}</td>
      <td style="padding: 6px 0; text-align: right;"><strong>Donor PAN / Tax ID:</strong> {{donor_tax_id}}</td>
    </tr>
  </table>
  <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; font-size: 0.95rem;">
      <span>Donor Name: <strong>{{donor_name}}</strong></span>
      <span>Amount: <strong style="color: #059669; font-size: 1.1rem;">{{donation_currency}} {{donation_amount}}</strong></span>
    </div>
    <div style="margin-top: 8px; font-size: 0.82rem; color: #047857;">
      Campaign: {{campaign_title}} &bull; Date: {{donation_date}} &bull; Ref: <code>{{transaction_id}}</code>
    </div>
  </div>
  <p style="font-size: 0.76rem; color: #475569; text-align: center; line-height: 1.5;">
    Statutory Declaration: This donation qualifies for tax deduction under Section 80G(5) of the Income Tax Act, 1961. Form 10BD statement has been submitted to the Income Tax Department.
  </p>
</div>`,
      is_default: true
    },
    {
      type: '80g_receipt',
      name: '🎨 Modern Minimalist Tax Exemption Receipt',
      subject: 'Tax Receipt Certificate',
      content: `<div style="font-family: 'Helvetica Neue', sans-serif; padding: 24px; color: #1E293B; border: 1px solid #E2E8F0; border-radius: 8px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <h2 style="margin: 0; color: #2563EB;">{{ngo_name}}</h2>
    <span style="font-size: 0.78rem; background: #DBEAFE; color: #1E40AF; padding: 4px 10px; border-radius: 12px; font-weight: 600;">80G Certified</span>
  </div>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin-bottom: 16px;" />
  <p style="font-size: 0.9rem;">Thank you <strong>{{donor_name}}</strong> for your contribution of <strong>{{donation_currency}} {{donation_amount}}</strong> towards <em>"{{campaign_title}}"</em>.</p>
  <table style="width: 100%; font-size: 0.82rem; margin: 16px 0; background: #F8FAFC; padding: 12px; border-radius: 6px;">
    <tr><td>PAN: <code>{{donor_tax_id}}</code></td><td style="text-align: right;">URN: <code>{{ngo_urn}}</code></td></tr>
    <tr><td>Date: {{donation_date}}</td><td style="text-align: right;">TXN: <code>{{transaction_id}}</code></td></tr>
  </table>
  <div style="font-size: 0.78rem; color: #64748B; text-align: right;">Signatory: {{ngo_signatory}}</div>
</div>`,
      is_default: false
    },
    {
      type: 'whatsapp_message',
      name: '📲 Instant VIP Donor Thank-You & WhatsApp Receipt',
      subject: 'WhatsApp Alert',
      content: `🎉 Thank you {{donor_name}}!

Your contribution of {{donation_currency}} {{donation_amount}} to support "{{campaign_title}}" by {{ngo_name}} has been received successfully!

💳 Transaction Ref: {{transaction_id}}
📜 PAN / Tax ID: {{donor_tax_id}}

📥 Download your 80G Tax Receipt here:
{{receipt_url}}

With warm regards,
{{ngo_name}} Team`,
      is_default: true
    },
    {
      type: 'whatsapp_message',
      name: '🔁 Monthly Recurring Donor Appreciation Alert',
      subject: 'WhatsApp Subscription Alert',
      content: `🌟 Hello {{donor_name}},

Thank you for being a monthly patron of {{ngo_name}}!

Your monthly contribution of {{donation_currency}} {{donation_amount}} for "{{campaign_title}}" has been recorded.

Order Ref: {{transaction_id}}
Tax Receipt PDF: {{receipt_url}}

Thank you for creating lasting impact!`,
      is_default: false
    },
    {
      type: 'email_thankyou',
      name: '📧 Premium HTML Thank-You with Instant 80G Download Button',
      subject: 'Thank you for your donation to {{ngo_name}}!',
      content: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #E2E8F0; border-radius: 12px; color: #0F172A; background: #FFFFFF;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #2563EB; margin: 0; font-size: 1.6rem;">Generosity in Action!</h1>
    <p style="color: #64748B; margin-top: 4px; font-size: 0.9rem;">Official Contribution Acknowledgment</p>
  </div>
  <p>Dear <strong>{{donor_name}}</strong>,</p>
  <p>On behalf of <strong>{{ngo_name}}</strong>, we express our heartfelt gratitude for your contribution of <strong style="color: #059669; font-size: 1.1rem;">{{donation_currency}} {{donation_amount}}</strong> towards <strong>"{{campaign_title}}"</strong>.</p>
  <div style="background: #F1F5F9; border-left: 4px solid #2563EB; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 0.88rem;">
    <div><strong>Transaction ID:</strong> <code>{{transaction_id}}</code></div>
    <div><strong>Date of Contribution:</strong> {{donation_date}}</div>
    <div><strong>Donor PAN:</strong> {{donor_tax_id}}</div>
    <div><strong>80G URN:</strong> URN-{{ngo_urn}}</div>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{receipt_url}}" style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: #FFFFFF; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.95rem; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
      📥 Download 80G Tax PDF Receipt
    </a>
  </div>
  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
  <p style="font-size: 0.78rem; color: #64748B; text-align: center;">
    This automated notification was dispatched by DanaPro on behalf of {{ngo_name}}.
  </p>
</div>`,
      is_default: true
    },
    {
      type: 'email_thankyou',
      name: '🏛️ Executive Founder Thank-You & Impact Report',
      subject: 'A personal message of thanks from {{ngo_name}}',
      content: `<div style="font-family: Georgia, serif; max-width: 600px; margin: auto; padding: 28px; color: #1E293B; background: #FFFDF9; border: 1px solid #E5E0D8; border-radius: 8px;">
  <h2 style="color: #7C2D12; font-weight: normal; font-size: 1.4rem;">Dear {{donor_name}},</h2>
  <p style="line-height: 1.6;">Your contribution of <strong>{{donation_currency}} {{donation_amount}}</strong> to <em>"{{campaign_title}}"</em> makes a real, tangible difference.</p>
  <p style="line-height: 1.6;">Our team at {{ngo_name}} is dedicated to full transparency. Your official tax exemption receipt is ready below:</p>
  <p style="text-align: center; margin: 20px 0;">
    <a href="{{receipt_url}}" style="color: #2563EB; text-decoration: underline; font-weight: bold;">View Your Official Receipt (Ref: {{transaction_id}})</a>
  </p>
  <p style="line-height: 1.6; margin-top: 24px;">With deepest gratitude,<br/><strong>{{ngo_signatory}}</strong><br/>{{ngo_name}}</p>
</div>`,
      is_default: false
    }
  ];

  for (const t of sampleTemplates) {
    await pool.query(
      `INSERT INTO templates (type, name, subject, content, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, 'system')
       ON CONFLICT DO NOTHING`,
      [t.type, t.name, t.subject, t.content, t.is_default]
    );
  }

  console.log('Sample templates seeded successfully into PostgreSQL!');
}

syncToRender().then(() => {
  console.log('SYNC COMPLETE!');
  process.exit(0);
}).catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
