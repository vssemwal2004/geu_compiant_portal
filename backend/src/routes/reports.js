const express = require('express');
const { Ticket } = require('../models');
const { wrap } = require('../services/common');
const router = express.Router();
router.get('/', wrap(async (_req, res) => {
  const tickets = await Ticket.find().lean();
  const by = key => Object.fromEntries([...new Set(tickets.map(t => t[key] || 'UNASSIGNED'))].map(value => [value, tickets.filter(t => (t[key] || 'UNASSIGNED') === value).length]));
  res.json({ total: tickets.length, byStatus: by('status'), byPriority: by('priority'), byAssetType: by('assetTypeId'), byAssignee: by('assignedTo'),
    overdue: tickets.filter(t => ['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(t.status) && new Date(t.dueAt).getTime() < Date.now()).length,
    resolved: tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length });
}));
module.exports = router;
