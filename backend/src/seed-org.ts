import pool from './config/db';

async function seed() {
  const check = await pool.query('SELECT id FROM organizations LIMIT 1');
  if (check.rows.length === 0) {
    const wa = {
      provider: 'evolution_go',
      evolution_go: {
        api_url: 'http://localhost:8080',
        instance_name: 'danapro_main',
        api_key: 'evolution-global-key-here'
      }
    };
    const em = {
      provider: 'ses',
      sender_name: 'DanaPro Foundation',
      from_email: 'donations@danapro.org'
    };
    await pool.query(
      `INSERT INTO organizations (name, slug, tax_id_country, primary_currency, whatsapp_config, email_config) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['DanaPro Foundation', 'danapro', 'IN', 'INR', wa, em]
    );
    console.log('✅ Default DanaPro Foundation organization created in DB!');
  } else {
    console.log('Organization already exists in DB:', check.rows[0].id);
  }
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
