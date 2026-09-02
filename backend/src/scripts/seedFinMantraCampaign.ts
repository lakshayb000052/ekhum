import pool from '../config/db';

async function seedFinMantra() {
  try {
    console.log('Verifying FinMantra campaign in PostgreSQL...');

    // 1. Get or create an NGO organization
    let orgRes = await pool.query("SELECT id FROM organizations LIMIT 1");
    let orgId = orgRes.rows[0]?.id;

    if (!orgId) {
      const newOrg = await pool.query(`
        INSERT INTO organizations (name, slug, tax_id_country, primary_currency)
        VALUES ('FinMantra Foundation', 'finmantra-foundation', 'IN', 'INR')
        RETURNING id
      `);
      orgId = newOrg.rows[0].id;
    }

    // 2. Insert or update finmantra_campaign with api_key = 'ek_live_finmantra_campaign_946342'
    const campRes = await pool.query(
      `INSERT INTO campaigns (organization_id, title, description, slug, api_key, landing_page_url, is_active, approval_status, goal_amount)
       VALUES ($1, 'FinMantra Empowerment Campaign 2026', 'Official FinMantra NGO Campaign for Financial Empowerment', 'finmantra_campaign', 'ek_live_finmantra_campaign_946342', 'http://localhost:8000', true, 'approved', 500000)
       ON CONFLICT (slug) 
       DO UPDATE SET api_key = 'ek_live_finmantra_campaign_946342', is_active = true, approval_status = 'approved', landing_page_url = 'http://localhost:8000'
       RETURNING id, title, slug, api_key`,
      [orgId]
    );

    console.log('Successfully configured FinMantra campaign:', campRes.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding FinMantra campaign:', err);
    process.exit(1);
  }
}

seedFinMantra();
