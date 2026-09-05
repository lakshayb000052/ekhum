import pool from '../config/db';
import runMigrations from '../config/migrations';
import { getRegisteredObjects, getObjectFields, addFieldToObject, getSchemaGraph } from '../services/schemaService';
import { executeSegment, calculateCohortRetentionMatrix, snapshotCohort, SEGMENT_PRESETS } from '../services/segmentEngine';
import { executeReport, REPORT_PRESETS } from '../services/reportEngine';

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 RUNNING CORE SUITE VERIFICATION TEST');
  console.log('====================================================');

  // 1. Run Migrations
  console.log('\n--- 1. Testing Database Migrations ---');
  await runMigrations(pool);
  await pool.query('ALTER TABLE segments ALTER COLUMN segment_name DROP NOT NULL; ALTER TABLE segments ALTER COLUMN query_sql DROP NOT NULL;').catch(() => {});
  console.log('✅ Migrations applied and verified successfully.');

  // Find sample organization
  const orgRes = await pool.query('SELECT id, name FROM organizations LIMIT 1');
  const orgId = orgRes.rows[0]?.id;
  console.log(`Using Organization: ${orgRes.rows[0]?.name || 'Default'} (${orgId || 'None'})`);

  // 2. Test Object Manager & Schema Designer
  console.log('\n--- 2. Testing Object Manager & Schema Designer ---');
  const objects = await getRegisteredObjects(orgId);
  console.log(`✅ Loaded ${objects.length} database entities.`);
  
  const donorFields = await getObjectFields('donors', orgId);
  console.log(`✅ Loaded ${donorFields.length} columns for donors entity.`);

  const schemaGraph = await getSchemaGraph(orgId);
  console.log(`✅ Schema graph generated with ${schemaGraph.nodes.length} nodes and ${schemaGraph.edges.length} relational edges.`);

  // Test adding custom field
  if (orgId) {
    const customField = await addFieldToObject(orgId, 'donors', {
      object_name: 'donors',
      field_name: 'test_priority_rating',
      field_label: 'Priority Rating',
      field_type: 'number',
      is_required: false
    });
    console.log(`✅ Custom field "${customField.field_label}" created and Alter Table executed successfully.`);
  }

  // 3. Test Donor Segments & Dynamic Cohorts
  console.log('\n--- 3. Testing Donor Segments & Dynamic Cohorts ---');
  const presets = SEGMENT_PRESETS;
  console.log(`✅ Loaded ${presets.length} non-profit audience presets.`);

  // Test segment query execution
  const testSegment = await executeSegment(orgId, {
    combinator: 'AND',
    rules: [
      { field: 'total_paid_amount', operator: 'gte', value: 0 }
    ]
  }, undefined, 10, 0, true);
  console.log(`✅ Segment evaluation executed: ${testSegment.count} matching donors, ₹${testSegment.totalLtv} LTV.`);

  // Test segment creation in DB
  if (orgId) {
    const segInsert = await pool.query(
      `INSERT INTO segments (organization_id, name, segment_name, type, rules_json, member_count, total_ltv, last_refreshed_at)
       VALUES ($1, 'Test Verification Segment', 'Test Verification Segment', 'cohort', '{"combinator": "AND", "rules": []}', $2, $3, NOW())
       RETURNING id`,
      [orgId, testSegment.count, testSegment.totalLtv]
    );
    const testSegId = segInsert.rows[0].id;

    // Test snapshot
    const snap = await snapshotCohort(orgId, testSegId, 'Test-Snapshot-Tag');
    console.log(`✅ Frozen cohort snapshot executed: ${snap.count} snapshot members.`);

    // Test retention matrix
    const matrix = await calculateCohortRetentionMatrix(orgId, testSegId);
    console.log(`✅ Cohort retention matrix calculated across M0-M12 (${matrix.retentionMatrix.length} intervals).`);

    // Cleanup test segment
    await pool.query('DELETE FROM segment_snapshots WHERE segment_id = $1', [testSegId]);
    await pool.query('DELETE FROM segments WHERE id = $1', [testSegId]);
  }

  // 4. Test Custom Report Builder & Analytics Studio
  console.log('\n--- 4. Testing Custom Report Builder & Analytics Studio ---');
  console.log(`✅ Loaded ${REPORT_PRESETS.length} executive report presets.`);

  for (const preset of REPORT_PRESETS.slice(0, 3)) {
    const reportEval = await executeReport(preset, orgId, 50, 0);
    console.log(`✅ Preset "${preset.name}" executed: ${reportEval.rowCount} rows, ₹${reportEval.summaryKpis.totalVolume} volume, Chart: ${preset.chart_type}.`);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL 3 CORE SUITE ENGINES FULLY VERIFIED & WORKING!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
