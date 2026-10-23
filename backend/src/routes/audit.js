const express = require('express');
const { AuditLog } = require('../models');
const { plain, wrap } = require('../services/common');
const router = express.Router();
router.get('/', wrap(async (req, res) => res.json((await AuditLog.find().sort({ at: -1 }).limit(Math.min(Number(req.query.limit) || 100, 500)).lean()).map(log => ({ ...plain(log), id: String(log._id) })))));
module.exports = router;
