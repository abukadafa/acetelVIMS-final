/**
 * ACETEL VIMS — Full Data Reset + Fresh Seed
 * Wipes ALL dynamic data and recreates baseline:
 *   ✓ Tenant (preserved / upserted)
 *   ✓ Admin user (fresh password from ADMIN_PASSWORD env)
 *   ✓ Programmes
 *   ✗ All students, staff, companies, logbooks, chats, notifications, emails, audit logs
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/acetel_ims';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@acetel.ng';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Acetel@#2025!';

async function reset() {
  console.log('\n🔄  Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  // ── 1. List collections to drop ──────────────────────────────────────────
  const WIPE = [
    'users', 'students', 'companies',
    'logbooks', 'attendances', 'programmes',
    'emailrecords', 'chats', 'notifications',
    'auditlogs', 'refreshtokens', 'feedbacks',
    'assessments', 'applications', 'settings',
    'blockedips', 'iptrackers', 'joblocks',
  ];

  console.log('\n🗑️   Wiping collections…');
  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);
  for (const col of WIPE) {
    if (existingCollections.includes(col)) {
      await db.collection(col).deleteMany({});
      console.log(`    ✓ Cleared: ${col}`);
    }
  }

  // ── 2. Ensure Tenant ─────────────────────────────────────────────────────
  const tenants = db.collection('tenants');
  let tenant = await tenants.findOne({ slug: 'acetel' });
  if (!tenant) {
    const res = await tenants.insertOne({
      name: 'ACETEL',
      slug: 'acetel',
      institutionType: 'University',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tenant = await tenants.findOne({ _id: res.insertedId });
  }
  const tenantId = tenant!._id;
  console.log('\n✅  Tenant ready:', tenantId);

  // ── 3. Seed Programmes ────────────────────────────────────────────────────
  const programmes = db.collection('programmes');
  const progList = [
    { code: 'MSC-AI',  name: 'MSc Artificial Intelligence',           level: 'MSc' },
    { code: 'MSC-CYB', name: 'MSc Cybersecurity',                     level: 'MSc' },
    { code: 'MSC-MIS', name: 'MSc Management Information Systems',    level: 'MSc' },
    { code: 'PHD-AI',  name: 'PhD Artificial Intelligence',           level: 'PhD' },
    { code: 'PHD-CYB', name: 'PhD Cybersecurity',                     level: 'PhD' },
    { code: 'PHD-MIS', name: 'PhD Management Information Systems',    level: 'PhD' },
  ];
  for (const p of progList) {
    await programmes.updateOne(
      { code: p.code, tenant: tenantId },
      { $set: { ...p, tenant: tenantId, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`✅  ${progList.length} programmes seeded`);

  // ── 4. Create Admin (raw — seed.ts bcrypt hook won't run) ────────────────
  //    We use bcrypt directly so the password is properly hashed
  const bcrypt = await import('bcryptjs');
  const hashedPwd = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const users = db.collection('users');
  await users.deleteMany({ email: ADMIN_EMAIL }); // ensure clean slate
  await users.insertOne({
    email:     ADMIN_EMAIL,
    username:  'admin',
    password:  hashedPwd,
    role:      'admin',
    firstName: 'ACETEL',
    lastName:  'Administrator',
    tenant:    tenantId,
    isActive:  true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`✅  Admin created → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  // ── 5. Seed basic Settings ────────────────────────────────────────────────
  const settings = db.collection('settings');
  const settingsList = [
    { key: 'academic_session', value: '2024/2025' },
    { key: 'system_name',      value: 'ACETEL Internship Management System' },
    { key: 'institution',      value: 'National Open University of Nigeria (NOUN)' },
  ];
  for (const s of settingsList) {
    await settings.updateOne(
      { key: s.key, tenant: tenantId },
      { $set: { ...s, tenant: tenantId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log('✅  Settings seeded');

  console.log('\n🎉  Reset complete! Database is clean and ready for testing.');
  console.log(`\n    Login: ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

reset().catch(err => {
  console.error('❌  Reset failed:', err.message);
  process.exit(1);
});
