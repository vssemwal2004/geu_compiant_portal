const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const request = require('supertest');
const mongoose = require('mongoose');

const binary = process.env.MONGOD_BINARY || path.join(os.homedir(), '.cache/mongodb-binaries/mongod-arm64-darwin-7.0.14');
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitMongo(uri) {
  for (let i = 0; i < 40; i++) {
    try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 300 }); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Local MongoDB did not start.');
}

test('MongoDB-backed role workflow, password setup, SMS login, and access control', { skip: !process.env.MONGODB_TEST_URI && !fs.existsSync(binary) }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'geu-mongo-test-'));
  let processMongo;
  try {
    const uri = process.env.MONGODB_TEST_URI || `mongodb://127.0.0.1:${await freePort()}`;
    if (!process.env.MONGODB_TEST_URI) {
      processMongo = spawn(binary, ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', new URL(uri.replace('mongodb://', 'http://')).port, '--quiet'], { stdio: 'ignore' });
      await waitMongo(uri);
      await mongoose.disconnect();
    }
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = `geu_test_${Date.now()}`;
    process.env.SEED_ADMIN_EMAIL = 'admin@example.com';
    process.env.SEED_ADMIN_PASSWORD = 'TestingPass123';
    process.env.MSG91_AUTH_KEY = 'test-key';
    process.env.MSG91_SMS_TEMPLATE_ID = 'test-template';
    const { start } = require('../src/server');
    const app = await start();
    const root = '/api/v1';
    const admin = request.agent(app), lab = request.agent(app), sub = request.agent(app);
    assert.equal((await request(app).get(`${root}/tickets`)).status, 401);
    const adminLogin = await admin.post(`${root}/auth/login`).send({ identifier: 'admin@example.com', password: 'TestingPass123' });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.body.user.passwordChangeRequired, true);
    assert.equal((await admin.get(`${root}/admin/users`)).status, 403);
    assert.equal((await admin.post(`${root}/auth/change-password`).send({ currentPassword: 'TestingPass123', newPassword: 'AdminChanged123' })).status, 200);
    const makeLocation = async (name, type, parentId) => {
      const r = await admin.post(`${root}/admin/locations`).send({ name, type, parentId });
      assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.id;
    };
    const campus = await makeLocation('Main Campus', 'CAMPUS');
    const building = await makeLocation('GR Block', 'BUILDING', campus);
    const floor = await makeLocation('Floor 2', 'FLOOR', building);
    const room = await makeLocation('Lab 205', 'LAB', floor);
    const asset = await admin.post(`${root}/admin/asset-types`).send({ name: 'Computer', code: 'COMP', defaultPriority: 'MEDIUM' });
    assert.equal(asset.status, 201);
    const viewerUser = await admin.post(`${root}/admin/users`).send({ name: 'Campus Observer', email: 'viewer@example.com', employeeId: 'GEU-A-101', role: 'ADMIN', password: 'ViewerStart123' });
    assert.equal(viewerUser.status, 201, JSON.stringify(viewerUser.body));
    assert.deepEqual(viewerUser.body.permissions, ['VIEW_ALL']);
    const viewer = request.agent(app);
    assert.equal((await viewer.post(`${root}/auth/login`).send({ identifier: 'viewer@example.com', password: 'ViewerStart123' })).body.user.passwordChangeRequired, true);
    assert.equal((await viewer.get(`${root}/tickets`)).status, 403);
    assert.equal((await viewer.post(`${root}/auth/change-password`).send({ currentPassword: 'ViewerStart123', newPassword: 'ViewerChanged123' })).status, 200);
    const subUser = await admin.post(`${root}/admin/users`).send({ name: 'GR IT Admin', email: 'grit@example.com', employeeId: 'GEU-S-101', role: 'SUB_ADMIN', password: 'ExamplePass123', scopeLocationIds: [building] });
    const labUser = await admin.post(`${root}/admin/users`).send({ name: 'Lab Assistant', email: 'lab@example.com', employeeId: 'GEU-L-201', role: 'LAB_ASSISTANT', phone: '+919000000001', password: 'ExamplePass123', allowedLocationIds: [building], defaultLocationId: room });
    assert.equal(subUser.status, 201, JSON.stringify(subUser.body));
    assert.equal(labUser.status, 201, JSON.stringify(labUser.body));
    const botOnly = await admin.post(`${root}/admin/users`).send({ name: 'SMS Assistant', employeeId: 'GEU-L-202', role: 'LAB_ASSISTANT', phone: '+919000000002', allowedLocationIds: [building], defaultLocationId: room });
    assert.equal(botOnly.status, 201, JSON.stringify(botOnly.body));
    assert.equal(botOnly.body.status, 'ACTIVE');
    assert.equal((await admin.post(`${root}/routing/rules`).send({ locationId: building, assetTypeId: asset.body.id, subAdminId: subUser.body.id })).status, 201);
    assert.equal((await lab.post(`${root}/auth/login`).send({ identifier: 'lab@example.com', password: 'ExamplePass123' })).body.user.passwordChangeRequired, true);
    assert.equal((await lab.get(`${root}/reference`)).status, 403);
    assert.equal((await lab.post(`${root}/auth/change-password`).send({ currentPassword: 'ExamplePass123', newPassword: 'LabChanged123' })).status, 200);
    assert.equal((await sub.post(`${root}/auth/login`).send({ identifier: 'grit@example.com', password: 'ExamplePass123' })).status, 200);
    assert.equal((await sub.post(`${root}/auth/change-password`).send({ currentPassword: 'ExamplePass123', newPassword: 'SubChanged123' })).status, 200);
    const labReference = await lab.get(`${root}/reference`);
    assert.equal(labReference.status, 200);
    assert.equal(labReference.body.users.some(user => user.email || user.phone || user.employeeId), false);
    const imageUrl = `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`;
    const created = await lab.post(`${root}/tickets`).send({ locationId: room, assetTypeId: asset.body.id, description: 'Computer screen is not working', imageUrl });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.assignedTo, subUser.body.id);
    const code = created.body.id;
    assert.equal((await lab.get(created.body.imageUrl)).status, 200);
    const viewerTickets = await viewer.get(`${root}/tickets`);
    assert.equal(viewerTickets.status, 200);
    assert.equal(viewerTickets.body.some(ticket => ticket.id === code && ticket.assignedTo === subUser.body.id && ticket.status === 'OPEN'), true);
    assert.equal((await viewer.get(`${root}/tickets/${code}`)).status, 200);
    assert.equal((await viewer.get(created.body.imageUrl)).status, 200);
    assert.equal((await viewer.post(`${root}/tickets`).send({ locationId: room, assetTypeId: asset.body.id, description: 'Should not create', imageUrl })).status, 403);
    assert.equal((await viewer.post(`${root}/admin/users`).send({ name: 'Nope' })).status, 403);
    assert.equal((await viewer.post(`${root}/admin/locations`).send({ name: 'Nope', type: 'LAB' })).status, 403);
    assert.equal((await viewer.patch(`${root}/tickets/${code}/assignee`).send({ assigneeId: subUser.body.id })).status, 403);
    assert.equal((await viewer.patch(`${root}/tickets/${code}/status`).send({ to: 'IN_PROGRESS' })).status, 403);
    assert.equal((await viewer.patch(`${root}/tickets/${code}/priority`).send({ priority: 'HIGH' })).status, 403);
    assert.equal((await viewer.post(`${root}/tickets/${code}/messages`).send({ body: 'Should not post' })).status, 403);
    assert.equal((await viewer.post(`${root}/uploads/tickets/${code}/evidence`).set('Content-Type', 'image/png').send(Buffer.from('blocked'))).status, 403);
    assert.equal((await viewer.get(`${root}/admin/reports`)).status, 403);
    const otherSub = await admin.post(`${root}/admin/users`).send({ name: 'Other Resolver', email: 'other@example.com', employeeId: 'GEU-S-102', role: 'SUB_ADMIN', password: 'ExamplePass123' });
    assert.equal(otherSub.status, 201);
    const other = request.agent(app);
    assert.equal((await other.post(`${root}/auth/login`).send({ identifier: 'other@example.com', password: 'ExamplePass123' })).status, 200);
    assert.equal((await other.post(`${root}/auth/change-password`).send({ currentPassword: 'ExamplePass123', newPassword: 'OtherChanged123' })).status, 200);
    assert.equal((await other.get(`${root}/tickets/${code}`)).status, 404);
    assert.equal((await other.get(created.body.imageUrl)).status, 404);
    assert.equal((await sub.get(`${root}/tickets/${code}`)).status, 200);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'IN_PROGRESS' })).status, 200);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'RESOLVED', note: 'Fixed' })).status, 403);
    const evidence = await sub.post(`${root}/uploads/tickets/${code}/evidence`).set('Content-Type', 'image/png').send(Buffer.from('evidence-image'));
    assert.equal(evidence.status, 201, JSON.stringify(evidence.body));
    assert.equal((await sub.post(`${root}/tickets/${code}/messages`).send({ body: 'Internal repair note', visibility: 'INTERNAL' })).status, 200);
    assert.equal((await viewer.get(`${root}/tickets/${code}`)).body.events.some(e => e.text === 'Internal repair note'), true);
    assert.equal((await lab.get(`${root}/tickets/${code}`)).body.events.some(e => e.text === 'Internal repair note'), false);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'RESOLVED', note: 'Replaced display cable' })).status, 200);
    assert.equal((await lab.patch(`${root}/tickets/${code}/status`).send({ to: 'REOPENED', note: 'Still flickering' })).status, 200);
    assert.equal((await admin.get(`${root}/admin/reports`)).body.total, 1);
    assert.equal((await admin.get(`${root}/admin/audit-logs`)).status, 200);
    assert.equal((await admin.get(`${root}/admin/roles`)).body.length, 4);
    assert.equal((await request(app).post(`${root}/webhooks/whatsapp`).send({})).status, 401);
    const originalFetch = global.fetch;
    let smsCode;
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://control.msg91.com/api/v5/flow');
      assert.equal(options.headers.authkey, 'test-key');
      const body = JSON.parse(options.body);
      assert.equal(body.template_id, 'test-template');
      smsCode = body.recipients[0].VAR1;
      return { ok: true, json: async () => ({ type: 'success' }) };
    };
    try {
      const mobile = request.agent(app);
      assert.equal((await mobile.post(`${root}/auth/otp/request`).send({ phone: '+919000000002' })).status, 200);
      assert.match(smsCode, /^\d{6}$/);
      assert.equal((await mobile.post(`${root}/auth/otp/verify`).send({ phone: '+919000000002', code: smsCode === '999999' ? '000000' : '999999' })).status, 401);
      assert.equal((await mobile.post(`${root}/auth/otp/verify`).send({ phone: '+919000000002', code: smsCode })).status, 200);
      assert.equal((await mobile.get(`${root}/reference`)).status, 200);
      assert.equal((await mobile.post(`${root}/auth/otp/verify`).send({ phone: '+919000000002', code: smsCode })).status, 401);
    } finally { global.fetch = originalFetch; }
    const port = await freePort();
    const cli = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '../src'), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CLI server did not start.')), 7000);
        cli.stdout.on('data', chunk => { if (String(chunk).includes('API ready')) { clearTimeout(timer); resolve(); } });
        cli.on('error', reject);
        cli.on('exit', code => reject(new Error(`CLI server exited early (${code}).`)));
      });
      assert.equal((await fetch(`http://127.0.0.1:${port}${root}/health`)).status, 200);
    } finally { cli.kill(); }
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    if (processMongo) processMongo.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
