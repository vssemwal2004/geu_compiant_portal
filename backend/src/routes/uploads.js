const express = require('express');
const { Attachment, Ticket } = require('../models');
const { error, wrap } = require('../services/common');
const tickets = require('../services/tickets');
const router = express.Router();
const rawImage = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' });
router.post('/ticket-image', rawImage, wrap(async (req, res) => {
  if (!['MAIN_ADMIN', 'LAB_ASSISTANT'].includes(req.user.role)) error(403, 'This role cannot upload issue images.');
  const attachmentId = await tickets.storeImage(req.user.id, 'ISSUE', req.get('content-type'), req.body);
  res.status(201).json({ storageKey: attachmentId });
}));
router.post('/tickets/:code/evidence', rawImage, wrap(async (req, res) => res.status(201).json(await tickets.evidence(req.user, req.params.code, req.get('content-type'), req.body))));
router.get('/:id', wrap(async (req, res) => {
  const attachment = await Attachment.findOne({ id: req.params.id }).lean();
  if (!attachment) error(404, 'Image not found.');
  if (attachment.ticketId) {
    const ticket = await Ticket.findOne({ id: attachment.ticketId }).lean();
    if (!ticket || !tickets.visible(req.user, ticket)) error(404, 'Image not found.');
  } else if (attachment.ownerId !== req.user.id) error(404, 'Image not found.');
  res.set('Cache-Control', 'private, max-age=300').type(attachment.mimeType).send(attachment.data);
}));
module.exports = router;
