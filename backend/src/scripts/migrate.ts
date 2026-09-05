import pool from '../config/db';
import runMigrations from '../config/migrations';

async function main() {
  console.log('🚀 Running database migrations...');
  try {
    await runMigrations(pool);
    console.log('✅ All migrations applied and verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

main();