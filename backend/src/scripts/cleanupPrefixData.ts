import pool from '../config/db';
import runMigrations from '../config/migrations';

async function cleanupPrefixData() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting complete prefix and test data purge across database...');

    // 1. Run migrations to ensure 007 is applied
    await runMigrations(pool);

    // 2. Explicitly update all API keys in organizations
    const orgUpdate = await client.query(`
      UPDATE organizations 
      SET api_key = REGEXP_REPLACE(api_key, '^(wg_live_|wg_test_|dp_live_|dp_test_)', 'ek_live_')
      WHERE api_key ~ '^(wg_live_|wg_test_|dp_live_|dp_test_)'
      RETURNING id, name, api_key
    `);
    console.log(`✅ Updated ${orgUpdate.rowCount} organizations API keys to 'ek_live_':`, orgUpdate.rows);

    // 3. Explicitly update all API keys in campaigns
    const campUpdate = await client.query(`
      UPDATE campaigns 
      SET api_key = REGEXP_REPLACE(api_key, '^(wg_live_|wg_test_|dp_live_|dp_test_)', 'ek_live_')
      WHERE api_key ~ '^(wg_live_|wg_test_|dp_live_|dp_test_)'
      RETURNING id, title, slug, api_key
    `);
    console.log(`✅ Updated ${campUpdate.rowCount} campaigns API keys to 'ek_live_':`, campUpdate.rows);

    // 4. Purge legacy test records
    const delNotes = await client.query(`DELETE FROM contact_notes WHERE author_name LIKE '%test%' OR content LIKE '%test%'`);
    const delReceipts80g = await client.query(`DELETE FROM eighty_g_receipts WHERE receipt_number LIKE '%test%' OR receipt_number LIKE '%MOCK%'`);
    const delReceiptsComp = await client.query(`DELETE FROM compliance_receipts WHERE receipt_number LIKE '%test%' OR receipt_number LIKE '%MOCK%'`);
    const delDonations = await client.query(`DELETE FROM donations WHERE status = 'initiated' AND created_at < NOW() - INTERVAL '10 minutes'`);
    const delDonors = await client.query(`DELETE FROM donors WHERE email LIKE 'donor_%@external.org' OR email LIKE 'test_%@%'`);

    console.log(`🧹 Purged:
      - ${delNotes.rowCount} test notes
      - ${delReceipts80g.rowCount} test 80G receipts
      - ${delReceiptsComp.rowCount} test compliance receipts
      - ${delDonations.rowCount} stale initiated test donations
      - ${delDonors.rowCount} placeholder/test donors
    `);

    console.log('🎉 Complete prefix data cleanup executed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error during prefix data cleanup:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

cleanupPrefixData();
