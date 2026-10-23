const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'geu-api-test-'));
process.env.DATA_FILE = path.join(directory, 'store.json');
process.env.SEED_ADMIN_EMAIL = 'admin@example.com';
process.env.SEED_ADMIN_PASSWORD = 'TestingPass123';
const { start } = require('../src/server');

test('admin, lab assistant and sub-admin complete a ticket lifecycle', async () => {
  const app = await start();
  const admin = request.agent(app);
  const lab = request.agent(app);
  const sub = request.agent(app);
  const base = '/api/v1';
  assert.equal((await request(app).get(`${base}/tickets`)).status, 401);
  assert.equal((await admin.post(`${base}/auth/login`).send({ identifier: 'admin@example.com', password: 'TestingPass123' })).status, 200);
  for (const id of ['u-sa-grit', 'u-la-negi']) {
    const result = await admin.patch(`${base}/admin/users/${id}`).send({ password: 'ExamplePass123' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
  assert.equal((await lab.post(`${base}/auth/login`).send({ identifier: 'rnegi@geu.ac.in', password: 'ExamplePass123' })).status, 200);
  assert.equal((await sub.post(`${base}/auth/login`).send({ identifier: 'grit@geu.ac.in', password: 'ExamplePass123' })).status, 200);
  const created = await lab.post(`${base}/tickets`).set('Idempotency-Key', 'example-1').send({ locationId: 'l-gr-205', assetTypeId: 'at-computer', description: 'The workstation does not start.' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.assignedTo, 'u-sa-grit');
  const code = created.body.id;
  assert.equal((await lab.get(`${base}/tickets`)).body.length, 1);
  assert.equal((await sub.get(`${base}/tickets`)).body.length, 1);
  assert.equal((await admin.get(`${base}/tickets`)).body.length, 1);
  assert.equal((await lab.post(`${base}/tickets`).set('Idempotency-Key', 'example-1').send({ locationId: 'l-gr-205', assetTypeId: 'at-computer', description: 'The workstation does not start.' })).body.id, code);
  assert.equal((await sub.patch(`${base}/tickets/${code}/status`).send({ to: 'IN_PROGRESS' })).status, 200);
  assert.equal((await sub.post(`${base}/tickets/${code}/messages`).send({ body: 'Staff note', visibility: 'INTERNAL' })).status, 200);
  assert.equal((await lab.get(`${base}/tickets/${code}`)).body.events.some(e => e.text === 'Staff note'), false);
  assert.equal((await sub.patch(`${base}/tickets/${code}/status`).send({ to: 'RESOLVED', note: 'Replaced power supply' })).status, 200);
  assert.equal((await lab.patch(`${base}/tickets/${code}/status`).send({ to: 'CLOSED' })).status, 200);
  assert.equal((await lab.get(`${base}/tickets/${code}`)).body.status, 'CLOSED');
  assert.equal(JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8')).tickets.length, 1);
  fs.rmSync(directory, { recursive: true, force: true });
});
