const express = require('express');
const { Ticket, AssetType } = require('../models');
const { error, wrap, audit } = require('../services/common');
const service = require('../services/tickets');
const router = express.Router();
router.get('/', wrap(async (req, res) => res.json(await service.scopedList(req.user, req.query))));
router.get('/summary', wrap(async (req, res) => {
  const tickets = await service.scopedList(req.user);
  res.json({ total: tickets.length, byStatus: Object.fromEntries(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED', 'CANCELLED'].map(s => [s, tickets.filter(t => t.status === s).length])) });
}));
router.get('/:code', wrap(async (req, res) => res.json(service.output(req.user, await service.getVisible(req.user, req.params.code)))));
router.post('/', wrap(async (req, res) => res.status(201).json(await service.create(req.user, req.body, { idempotencyKey: req.get('Idempotency-Key') }))));
router.patch('/:code/status', wrap(async (req, res) => res.json(await service.changeStatus(req.user, req.params.code, req.body.to, req.body.note))));
router.post('/:code/messages', wrap(async (req, res) => res.json(await service.addMessage(req.user, req.params.code, req.body.body, req.body.visibility))));
router.patch('/:code/assignee', wrap(async (req, res) => res.json(await service.assign(req.user, req.params.code, req.body.assigneeId, req.body.reason))));
router.post('/:code/escalations', wrap(async (req, res) => res.json(await service.escalate(req.user, req.params.code, req.body.reason))));
router.patch('/:code/priority', wrap(async (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') error(403, 'Super Admin only.');
  const ticket = await service.getVisible(req.user, req.params.code);
  if (!service.SLA_HOURS[req.body.priority]) error(400, 'Invalid priority.');
  const from = ticket.priority; ticket.priority = req.body.priority;
  ticket.dueAt = new Date(new Date(ticket.createdAt).getTime() + service.SLA_HOURS[ticket.priority] * 3600000);
  ticket.events.push({ id: require('node:crypto').randomUUID(), at: new Date().toISOString(), actorId: req.user.id, kind: 'PRIORITY', from, to: ticket.priority, text: req.body.reason || 'Priority changed', visibility: 'INTERNAL' });
  await ticket.save(); await audit(req.user.id, 'CHANGE_PRIORITY', 'Ticket', ticket.id, { from, to: ticket.priority });
  res.json(service.output(req.user, ticket));
}));
module.exports = router;
