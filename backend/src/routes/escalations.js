const express = require('express');
const { Ticket } = require('../models');
const { wrap } = require('../services/common');
const router = express.Router();
router.get('/', wrap(async (_req, res) => {
  const tickets = await Ticket.find({ 'events.kind': 'ESCALATION' }).lean();
  res.json(tickets.flatMap(t => t.events.filter(e => e.kind === 'ESCALATION').map(e => ({ ...e, ticketCode: t.id, status: t.status, assignedTo: t.assignedTo }))));
}));
module.exports = router;
