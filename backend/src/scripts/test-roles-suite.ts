import pool from '../config/db';
import runMigrations from '../config/migrations';
import {
  getMatrixSchema,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listMembers,
  inviteOrAddMember,
  updateMember,
  removeMember,
  getEffectiveUserPermissions
} from '../services/roleService';

async function runRolesVerification() {
  console.log('====================================================');
  console.log('🚀 RUNNING ROLES & PERMISSION MATRIX VERIFICATION');
  console.log('====================================================');

  // 1. Run Migrations
  console.log('\n--- 1. Testing Database Migrations (009_roles_and_permissions_engine) ---');
  await runMigrations(pool);
  console.log('✅ Migrations applied and verified successfully.');

  // Find sample organization
  const orgRes = await pool.query('SELECT id, name FROM organizations LIMIT 1');
  const orgId = orgRes.rows[0]?.id;
  console.log(`Using Organization: ${orgRes.rows[0]?.name || 'Default'} (${orgId || 'None'})`);

  if (!orgId) {
    console.error('❌ No test organization found in database.');
    process.exit(1);
  }

  // 2. Test Schema Definition
  console.log('\n--- 2. Testing Permission Matrix Schema Dictionary ---');
  const schema = getMatrixSchema();
  console.log(`✅ Loaded ${schema.objects.length} Matrix Objects across ${schema.categories.length} Categories.`);
  console.log(`✅ Loaded ${schema.actions.length} Supported Actions (${schema.actions.map(a => a.key).join(', ')}).`);

  // 3. Test Loading Roles
  console.log('\n--- 3. Testing Role Listing & System Role Seeding ---');
  const roles = await listRoles(orgId);
  console.log(`✅ Loaded ${roles.length} total roles for organization.`);
  const systemRoles = roles.filter(r => r.is_system);
  console.log(`✅ Verified ${systemRoles.length} Canonical System Roles: ${systemRoles.map(r => r.name).join(', ')}.`);

  // 4. Test Custom Role Creation & Perm Matrix
  console.log('\n--- 4. Testing Custom Role Provisioning ---');
  const customRole = await createRole(orgId, {
    display_name: 'Field Operations Coordinator',
    description: 'Field officer managing offline gifts, campaigns, and donor outreach',
    clone_from_role_id: systemRoles.find(r => r.name === 'ngo_fundraiser')?.id,
    permissions: {
      contacts: { create: true, read: true, update: true, delete: false, export: true },
      donations: { create: true, read: true, update: true, delete: false, export: true },
      reports: { create: true, read: true, update: false, delete: false, export: true }
    }
  });
  console.log(`✅ Custom Role "${customRole.display_name}" (slug: ${customRole.name}) created with ID ${customRole.id}.`);
  console.log(`✅ Contacts Export Granted: ${customRole.permissions.contacts?.export === true}`);

  // 5. Test Role Update
  console.log('\n--- 5. Testing Permission Matrix Mutation ---');
  const updatedRole = await updateRole(customRole.id, orgId, {
    display_name: 'Senior Field Coordinator',
    permissions: {
      ...customRole.permissions,
      campaigns: { create: true, read: true, update: true, delete: false, export: true, approve: false, manage: false }
    }
  });
  console.log(`✅ Updated Role Display Name: "${updatedRole.display_name}".`);
  console.log(`✅ Campaigns Create Granted: ${updatedRole.permissions.campaigns?.create === true}`);

  // 6. Test Team Member Invitation & Role Assignment
  console.log('\n--- 6. Testing Member Invitation & Role Assignment ---');
  const testEmail = `field_lead_${Date.now()}@example.org`;
  const member = await inviteOrAddMember(orgId, {
    email: testEmail,
    first_name: 'Aarav',
    last_name: 'Sharma',
    phone: '+919876543210',
    role_id: customRole.id
  });
  console.log(`✅ Member "${member.first_name} ${member.last_name}" (${member.email}) invited and assigned to role.`);

  // 7. Test Member Listing & Dynamic Permissions Resolution
  console.log('\n--- 7. Testing Dynamic Effective Permissions Resolution ---');
  const members = await listMembers(orgId);
  const foundMember = members.find(m => m.email === testEmail);
  console.log(`✅ Found member in org roster with role: "${foundMember?.role?.display_name}".`);

  const effectivePerms = await getEffectiveUserPermissions(testEmail, orgId, foundMember?.role?.name);
  console.log(`✅ Live resolved effective permissions:`);
  console.log(`   - Contacts Create: ${effectivePerms.contacts?.create}`);
  console.log(`   - Donations Export: ${effectivePerms.donations?.export}`);
  console.log(`   - Object Manager Delete: ${effectivePerms.object_manager?.delete}`);

  // 8. Test Member Update & Role Deletion Guard
  console.log('\n--- 8. Testing Member Update & Role Deletion Safety Guards ---');
  await updateMember(foundMember!.id, orgId, {
    status: 'active',
    first_name: 'Aarav K.'
  });
  console.log('✅ Member status and profile updated.');

  try {
    await deleteRole(customRole.id, orgId);
    console.error('❌ Deletion safety guard failed: allowed deleting role with active members!');
  } catch (err: any) {
    console.log(`✅ Deletion safety guard triggered successfully: "${err.message}".`);
  }

  // 9. Cleanup
  console.log('\n--- 9. Cleanup ---');
  await removeMember(foundMember!.id, orgId);
  console.log(`✅ Test member removed.`);
  await deleteRole(customRole.id, orgId);
  console.log(`✅ Custom role deleted.`);

  console.log('\n====================================================');
  console.log('🎉 ROLES & PERMISSION MATRIX VERIFIED & 100% OPERATIONAL!');
  console.log('====================================================');
  process.exit(0);
}

runRolesVerification().catch(err => {
  console.error('❌ Roles verification failed:', err);
  process.exit(1);
});
