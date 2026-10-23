const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
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

test('MongoDB-backed role workflow, evidence, access control, and bot confirmation', { skip: !process.env.MONGODB_TEST_URI && !fs.existsSync(binary) }, async () => {
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
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '';
    const { start } = require('../src/server');
    const { handleMessage } = require('../src/services/whatsapp');
    const app = await start();
    const root = '/api/v1';
    const admin = request.agent(app), lab = request.agent(app), sub = request.agent(app);
    assert.equal((await request(app).get(`${root}/tickets`)).status, 401);
    assert.equal((await admin.post(`${root}/auth/login`).send({ identifier: 'admin@example.com', password: 'TestingPass123' })).status, 200);
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
    const subUser = await admin.post(`${root}/admin/users`).send({ name: 'GR IT Admin', email: 'grit@example.com', employeeId: 'GEU-S-101', role: 'SUB_ADMIN', password: 'ExamplePass123', scopeLocationIds: [building] });
    const labUser = await admin.post(`${root}/admin/users`).send({ name: 'Lab Assistant', email: 'lab@example.com', employeeId: 'GEU-L-201', role: 'LAB_ASSISTANT', phone: '+919000000001', password: 'ExamplePass123', allowedLocationIds: [building], defaultLocationId: room });
    assert.equal(subUser.status, 201, JSON.stringify(subUser.body));
    assert.equal(labUser.status, 201, JSON.stringify(labUser.body));
    const botOnly = await admin.post(`${root}/admin/users`).send({ name: 'WhatsApp Assistant', employeeId: 'GEU-L-202', role: 'LAB_ASSISTANT', phone: '+919000000002', allowedLocationIds: [building], defaultLocationId: room });
    assert.equal(botOnly.status, 201, JSON.stringify(botOnly.body));
    assert.equal(botOnly.body.status, 'INVITED');
    assert.equal((await admin.patch(`${root}/admin/users/${botOnly.body.id}`).send({ status: 'ACTIVE' })).status, 200);
    assert.equal((await admin.post(`${root}/routing/rules`).send({ locationId: building, assetTypeId: asset.body.id, subAdminId: subUser.body.id })).status, 201);
    assert.equal((await lab.post(`${root}/auth/login`).send({ identifier: 'lab@example.com', password: 'ExamplePass123' })).status, 200);
    assert.equal((await sub.post(`${root}/auth/login`).send({ identifier: 'grit@example.com', password: 'ExamplePass123' })).status, 200);
    const labReference = await lab.get(`${root}/reference`);
    assert.equal(labReference.status, 200);
    assert.equal(labReference.body.users.some(user => user.email || user.phone || user.employeeId), false);
    const imageUrl = `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`;
    const created = await lab.post(`${root}/tickets`).send({ locationId: room, assetTypeId: asset.body.id, description: 'Computer screen is not working', imageUrl });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.assignedTo, subUser.body.id);
    const code = created.body.id;
    assert.equal((await lab.get(created.body.imageUrl)).status, 200);
    const otherSub = await admin.post(`${root}/admin/users`).send({ name: 'Other Resolver', email: 'other@example.com', employeeId: 'GEU-S-102', role: 'SUB_ADMIN', password: 'ExamplePass123' });
    assert.equal(otherSub.status, 201);
    const other = request.agent(app);
    assert.equal((await other.post(`${root}/auth/login`).send({ identifier: 'other@example.com', password: 'ExamplePass123' })).status, 200);
    assert.equal((await other.get(`${root}/tickets/${code}`)).status, 404);
    assert.equal((await other.get(created.body.imageUrl)).status, 404);
    assert.equal((await sub.get(`${root}/tickets/${code}`)).status, 200);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'IN_PROGRESS' })).status, 200);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'RESOLVED', note: 'Fixed' })).status, 403);
    const evidence = await sub.post(`${root}/uploads/tickets/${code}/evidence`).set('Content-Type', 'image/png').send(Buffer.from('evidence-image'));
    assert.equal(evidence.status, 201, JSON.stringify(evidence.body));
    assert.equal((await sub.post(`${root}/tickets/${code}/messages`).send({ body: 'Internal repair note', visibility: 'INTERNAL' })).status, 200);
    assert.equal((await lab.get(`${root}/tickets/${code}`)).body.events.some(e => e.text === 'Internal repair note'), false);
    assert.equal((await sub.patch(`${root}/tickets/${code}/status`).send({ to: 'RESOLVED', note: 'Replaced display cable' })).status, 200);
    assert.equal((await lab.patch(`${root}/tickets/${code}/status`).send({ to: 'REOPENED', note: 'Still flickering' })).status, 200);
    assert.equal((await admin.get(`${root}/admin/reports`)).body.total, 1);
    assert.equal((await admin.get(`${root}/admin/audit-logs`)).status, 200);
    assert.equal((await admin.get(`${root}/admin/roles`)).body.length, 3);
    const badWebhook = await request(app).post(`${root}/webhooks/whatsapp`).set('Content-Type', 'application/json').set('x-hub-signature-256', 'sha256=bad').send('{}');
    assert.equal(badWebhook.status, 503);
    const config = require('../src/config');
    config.whatsapp.accessToken = 'fixture-token'; config.whatsapp.phoneNumberId = 'test-number';
    const rejected = await request(app).post(`${root}/webhooks/whatsapp`).set('Content-Type', 'application/json').set('x-hub-signature-256', 'sha256=bad').send('{}');
    assert.equal(rejected.status, 401);
    assert.equal((await request(app).get(`${root}/webhooks/whatsapp`).query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'test-verify', 'hub.challenge': 'verified' })).text, 'verified');
    const signedBody = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: 'test-number' }, messages: [] } }] }] });
    const signature = `sha256=${crypto.createHmac('sha256', 'test-secret').update(signedBody).digest('hex')}`;
    assert.equal((await request(app).post(`${root}/webhooks/whatsapp`).set('Content-Type', 'application/json').set('x-hub-signature-256', signature).send(signedBody)).status, 200);
    const sent = [];
    const send = async (_to, payload) => sent.push(payload);
    const media = async () => ({ mimeType: 'image/png', buffer: Buffer.from('bot-image') });
    const phone = '919000000001';
    const msg = (id, type, body) => ({ id, from: phone, type, ...(type === 'image' ? { image: { id: body } } : { text: { body } }) });
    await handleMessage({ id: 'unknown-1', from: '919999999999', type: 'text', text: { body: 'Hi' } }, { send, text: async (_to, body) => sent.push(body), media });
    assert.equal((await mongoose.model('BotSession').countDocuments({ phone: '+919999999999' })), 0);
    assert.match(String(sent.at(-1)), /Access denied/);
    const before = await mongoose.model('Ticket').countDocuments();
    await handleMessage(msg('w1', 'text', 'Hi'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w2', 'text', 'Create'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w3', 'image', 'media-1'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w4', 'text', 'Computer'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w5', 'text', 'Main Campus'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w6', 'text', 'GR Block'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w7', 'text', 'Floor 2'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w8', 'text', 'Lab 205'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w9', 'text', 'The computer display is broken'), { send, text: async (_to, body) => sent.push(body), media });
    assert.equal(await mongoose.model('Ticket').countDocuments(), before);
    await handleMessage(msg('w10', 'text', 'Edit'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w11', 'text', 'EDIT_DESCRIPTION'), { send, text: async (_to, body) => sent.push(body), media });
    await handleMessage(msg('w12', 'text', 'The computer monitor still flickers'), { send, text: async (_to, body) => sent.push(body), media });
    assert.equal(await mongoose.model('Ticket').countDocuments(), before);
    await handleMessage(msg('w13', 'text', 'Confirm'), { send, text: async (_to, body) => sent.push(body), media });
    assert.equal(await mongoose.model('Ticket').countDocuments(), before + 1);
    assert.equal((await mongoose.model('Ticket').findOne({ source: 'WHATSAPP' }).lean()).creatorId, labUser.body.id);
    assert.equal((await mongoose.model('Ticket').findOne({ source: 'WHATSAPP' }).lean()).description, 'The computer monitor still flickers');
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
