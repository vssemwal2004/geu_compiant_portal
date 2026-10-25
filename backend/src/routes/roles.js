const express = require('express');
const router = express.Router();
router.get('/', (_req, res) => res.json([
  { role: 'MAIN_ADMIN', label: 'Super Admin', permissions: ['Manage users', 'Manage locations and assets', 'Configure routing', 'View and override all tickets', 'View reports and audit logs'] },
  { role: 'ADMIN', label: 'Admin (read only)', permissions: ['View the overview and every ticket', 'View status, assignment, evidence and activity history', 'Cannot create or change records'] },
  { role: 'SUB_ADMIN', label: 'Ticket Resolver', permissions: ['View assigned tickets', 'Add internal remarks', 'Upload evidence', 'Resolve assigned tickets', 'Request escalation if permitted'] },
  { role: 'LAB_ASSISTANT', label: 'Complaint Creator', permissions: ['Create complaints', 'View own tickets', 'Add information', 'Confirm or dispute resolution'] },
]));
module.exports = router;
