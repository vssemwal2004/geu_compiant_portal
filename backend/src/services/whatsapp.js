const { URL } = require('node:url');
const config = require('../config');
const { User, BotSession, InboundMessage, AssetType, Location, Ticket, Attachment } = require('../models');
const { error, phoneE164, plain, ancestry } = require('./common');
const tickets = require('./tickets');
const graph = config.whatsapp;
const graphUrl = (part) => `${graph.graphBase}/${graph.graphVersion}/${part}`;

async function graphRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${graph.accessToken}`, ...options.headers } });
  if (!response.ok) throw new Error(`Meta Graph API returned ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response;
}
async function send(to, payload) {
  if (!graph.accessToken || !graph.phoneNumberId) error(503, 'WhatsApp outbound messaging is not configured.');
  const body = { messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/\D/g, ''), ...payload };
  await graphRequest(graphUrl(`${graph.phoneNumberId}/messages`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const sendText = (to, body) => send(to, { type: 'text', text: { body } });
function listPayload(body, rows, button = 'Choose') {
  return { type: 'interactive', interactive: { type: 'list', body: { text: body.slice(0, 1024) }, action: { button, sections: [{ title: 'Options', rows: rows.slice(0, 10).map(r => ({ id: r.id, title: r.title.slice(0, 24), description: r.description?.slice(0, 72) })) }] } } };
}
function buttonPayload(body, buttons) {
  return { type: 'interactive', interactive: { type: 'button', body: { text: body.slice(0, 1024) }, action: { buttons: buttons.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } } };
}
const menuRows = [
  { id: 'CREATE', title: 'Create New Ticket' }, { id: 'MY_TICKETS', title: 'My Active Tickets' },
  { id: 'CHECK_STATUS', title: 'Check Ticket Status' }, { id: 'ADD_INFO', title: 'Add Information' },
  { id: 'HELP', title: 'Help / Cancel' },
];
async function menu(to, transport) { await transport.send(to, listPayload('Welcome! Your number is verified. Choose an action:', menuRows, 'Menu')); }
async function downloadMedia(mediaId) {
  if (!graph.accessToken || !graph.phoneNumberId) error(503, 'WhatsApp media is not configured.');
  const meta = await (await graphRequest(graphUrl(`${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(graph.phoneNumberId)}`))).json();
  if (!meta.url) throw new Error('Meta did not provide a media URL.');
  const url = new URL(meta.url);
  if (url.protocol !== 'https:' || !['facebook.com', 'fbsbx.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('Untrusted media URL from Meta.');
  const response = await graphRequest(url);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 5 * 1024 * 1024) error(400, 'Image must be 5 MB or smaller.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) error(400, 'Image must be 5 MB or smaller.');
  return { mimeType: meta.mime_type || response.headers.get('content-type'), buffer };
}
function selection(message) {
  return message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || message.button?.payload || message.text?.body?.trim() || '';
}
function matchChoice(raw, choices, prefix) {
  const lower = raw.toLowerCase();
  return choices.find(x => raw === `${prefix}:${x.id}` || lower === x.name?.toLowerCase() || lower === x.code?.toLowerCase() || lower === String(choices.indexOf(x) + 1));
}
async function showChoices(to, prompt, items, prefix, transport, state) {
  if (!items.length) return transport.text(to, 'No active options are configured. Please contact the Main Admin. Reply Menu to start over.');
  const page = state.draft.page || 0;
  const start = page * 9;
  const chunk = items.slice(start, start + 9);
  const rows = chunk.map(x => ({ id: `${prefix}:${x.id}`, title: x.name }));
  if (items.length > start + 9) rows.push({ id: `page:${page + 1}`, title: 'More options' });
  await transport.send(to, listPayload(prompt, rows));
}
async function locationChoices(state, to, transport) {
  const type = { LOCATION_CAMPUS: 'CAMPUS', LOCATION_BUILDING: 'BUILDING', LOCATION_FLOOR: 'FLOOR', LOCATION_LAB: 'LAB' }[state.step];
  const parentId = { LOCATION_CAMPUS: null, LOCATION_BUILDING: state.draft.campusId, LOCATION_FLOOR: state.draft.buildingId, LOCATION_LAB: state.draft.floorId }[state.step];
  const locations = await Location.find({ type, parentId, active: true }).sort({ name: 1 }).lean();
  await showChoices(to, `Select ${type.toLowerCase()}:`, locations, 'loc', transport, state);
}
async function ticketStatus(user, code) {
  const ticket = await Ticket.findOne({ id: code, creatorId: user.id }).lean();
  if (!ticket) return 'Ticket not found in your account.';
  return `${ticket.id}: ${ticket.status.replace(/_/g, ' ')}. Assigned: ${ticket.assignedTo ? 'team member' : 'pending assignment'}.`;
}
async function confirmPrompt(state, to, transport) {
  const [asset, pathIds] = await Promise.all([AssetType.findOne({ id: state.draft.assetTypeId }).lean(), ancestry(state.draft.locationId)]);
  const locations = await Location.find({ id: { $in: pathIds } }).lean();
  const path = [...pathIds].reverse().map(id => locations.find(l => l.id === id)?.name).filter(Boolean).join(' → ');
  await transport.send(to, buttonPayload(`Confirm your complaint\nAsset: ${asset?.name}\nLocation: ${path}\nIssue: ${state.draft.description}\nReply Confirm or Edit.`, [{ id: 'CONFIRM', title: 'Confirm' }, { id: 'EDIT', title: 'Edit' }]));
}
async function persist(state) { state.markModified('draft'); await state.save(); }
async function handleMessage(message, dependencies = {}) {
  const transport = { send: dependencies.send || send, text: dependencies.text || sendText, media: dependencies.media || downloadMedia };
  const phone = phoneE164(message.from);
  const user = await User.findOne({ phoneE164: phone, role: 'LAB_ASSISTANT', status: 'ACTIVE' }).lean();
  if (!user) { await transport.text(phone, 'Access denied. Your mobile number is not registered as an active Lab Assistant.'); return; }
  let state = await BotSession.findOne({ phone });
  if (!state) state = new BotSession({ phone, step: 'MENU', draft: {} });
  const raw = selection(message);
  const command = raw.trim().toUpperCase();
  if (['HI', 'HELLO', 'MENU', 'CANCEL', 'HELP'].includes(command) || !state.step) {
    state.step = 'MENU'; state.draft = {}; await persist(state);
    if (command === 'HELP') await transport.text(phone, 'Use the menu to create or track tickets. Reply Cancel at any time to stop the current action.');
    await menu(phone, transport); return;
  }
  if (state.step === 'MENU') {
    if (['CREATE', '1', 'CREATE NEW TICKET', 'CREATE TICKET'].includes(command)) {
      state.step = 'WAIT_IMAGE'; state.draft = {}; await persist(state);
      await transport.text(phone, 'Please upload an image of the damaged asset. Reply Cancel to stop.'); return;
    }
    if (['MY_TICKETS', 'MY TICKETS', 'MY ACTIVE TICKETS', '2'].includes(command)) {
      const found = await Ticket.find({ creatorId: user.id, status: { $in: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'] } }).sort({ createdAt: -1 }).limit(10).lean();
      await transport.text(phone, found.length ? `Your active tickets:\n${found.map(t => `${t.id} — ${t.status.replace(/_/g, ' ')}`).join('\n')}` : 'You have no active tickets.');
      await menu(phone, transport); return;
    }
    if (['CHECK_STATUS', 'CHECK STATUS', '3'].includes(command)) { state.step = 'STATUS_CODE'; await persist(state); await transport.text(phone, 'Reply with your ticket code (for example GEU-2026-000001).'); return; }
    if (['ADD_INFO', 'ADD INFORMATION', 'ADD INFORMATION TO TICKET', '4'].includes(command)) { state.step = 'INFO_CODE'; await persist(state); await transport.text(phone, 'Reply with your ticket code to add information.'); return; }
    await menu(phone, transport); return;
  }
  if (state.step === 'WAIT_IMAGE') {
    if (message.type !== 'image' || !message.image?.id) { await transport.text(phone, 'Please send an image first.'); return; }
    const media = await transport.media(message.image.id);
    const imageAttachmentId = await tickets.storeImage(user.id, 'ISSUE', media.mimeType, media.buffer);
    if (state.draft.editField === 'IMAGE') {
      if (state.draft.imageAttachmentId) await Attachment.deleteOne({ id: state.draft.imageAttachmentId, ticketId: { $exists: false } });
      state.draft.imageAttachmentId = imageAttachmentId; delete state.draft.editField; state.step = 'CONFIRM'; await persist(state);
      await confirmPrompt(state, phone, transport); return;
    }
    state.draft = { imageAttachmentId, page: 0 }; state.step = 'ASSET'; await persist(state);
    await transport.text(phone, 'Image received. Select an asset type.');
    await showChoices(phone, 'Select asset type:', await AssetType.find({ active: true }).sort({ name: 1 }).lean(), 'asset', transport, state); return;
  }
  if (state.step === 'ASSET') {
    const assets = await AssetType.find({ active: true }).sort({ name: 1 }).lean();
    if (command.startsWith('PAGE:')) { state.draft.page = Number(command.slice(5)) || 0; await persist(state); await showChoices(phone, 'Select asset type:', assets, 'asset', transport, state); return; }
    const asset = matchChoice(raw, assets, 'asset');
    if (!asset) { await showChoices(phone, 'Choose an asset from the list:', assets, 'asset', transport, state); return; }
    if (state.draft.editField === 'ASSET') {
      state.draft.assetTypeId = asset.id; delete state.draft.editField; state.step = 'CONFIRM'; await persist(state);
      await confirmPrompt(state, phone, transport); return;
    }
    state.draft.assetTypeId = asset.id; state.draft.page = 0; state.step = 'LOCATION_CAMPUS'; await persist(state); await locationChoices(state, phone, transport); return;
  }
  if (state.step.startsWith('LOCATION_')) {
    const type = { LOCATION_CAMPUS: 'CAMPUS', LOCATION_BUILDING: 'BUILDING', LOCATION_FLOOR: 'FLOOR', LOCATION_LAB: 'LAB' }[state.step];
    const parentId = { LOCATION_CAMPUS: null, LOCATION_BUILDING: state.draft.campusId, LOCATION_FLOOR: state.draft.buildingId, LOCATION_LAB: state.draft.floorId }[state.step];
    const choices = await Location.find({ type, parentId, active: true }).sort({ name: 1 }).lean();
    if (command.startsWith('PAGE:')) { state.draft.page = Number(command.slice(5)) || 0; await persist(state); await locationChoices(state, phone, transport); return; }
    const chosen = matchChoice(raw, choices, 'loc');
    if (!chosen) { await locationChoices(state, phone, transport); return; }
    const field = { CAMPUS: 'campusId', BUILDING: 'buildingId', FLOOR: 'floorId', LAB: 'locationId' }[type];
    state.draft[field] = chosen.id; state.draft.page = 0;
    state.step = { CAMPUS: 'LOCATION_BUILDING', BUILDING: 'LOCATION_FLOOR', FLOOR: 'LOCATION_LAB', LAB: 'DESCRIPTION' }[type];
    if (type === 'LAB' && state.draft.editField === 'LOCATION') { delete state.draft.editField; state.step = 'CONFIRM'; }
    await persist(state);
    if (state.step === 'CONFIRM') await confirmPrompt(state, phone, transport);
    else if (state.step === 'DESCRIPTION') await transport.text(phone, 'Please describe the issue in at least 10 characters.');
    else await locationChoices(state, phone, transport);
    return;
  }
  if (state.step === 'DESCRIPTION') {
    const description = message.text?.body?.trim();
    if (!description || description.length < 10 || description.length > 1000) { await transport.text(phone, 'Please describe the issue in 10–1000 characters.'); return; }
    state.draft.description = description; delete state.draft.editField; state.step = 'CONFIRM'; await persist(state);
    await confirmPrompt(state, phone, transport); return;
  }
  if (state.step === 'CONFIRM') {
    if (command === 'EDIT') { state.step = 'EDIT'; await persist(state); await transport.send(phone, listPayload('What would you like to change?', [{ id: 'EDIT_IMAGE', title: 'Image' }, { id: 'EDIT_ASSET', title: 'Asset type' }, { id: 'EDIT_LOCATION', title: 'Location' }, { id: 'EDIT_DESCRIPTION', title: 'Description' }])); return; }
    if (command !== 'CONFIRM') { await transport.text(phone, 'Reply Confirm to create the ticket, or Edit to start again.'); return; }
    const ticket = await tickets.create(plain(user), state.draft, { source: 'WHATSAPP', idempotencyKey: message.id });
    state.step = 'MENU'; state.draft = {}; await persist(state);
    await transport.text(phone, `Ticket created: ${ticket.id}\nStatus: Open\nAssigned to: ${ticket.assignedTo ? 'responsible team' : 'pending assignment'}\nYou will receive updates here.`); return;
  }
  if (state.step === 'EDIT') {
    if (!['EDIT_IMAGE', 'EDIT_ASSET', 'EDIT_LOCATION', 'EDIT_DESCRIPTION'].includes(command)) { await transport.text(phone, 'Choose Image, Asset type, Location or Description.'); return; }
    const field = command.slice(5);
    state.draft.editField = field; state.draft.page = 0;
    state.step = { IMAGE: 'WAIT_IMAGE', ASSET: 'ASSET', LOCATION: 'LOCATION_CAMPUS', DESCRIPTION: 'DESCRIPTION' }[field];
    await persist(state);
    if (field === 'IMAGE') await transport.text(phone, 'Send the replacement image.');
    if (field === 'ASSET') await showChoices(phone, 'Select the new asset type:', await AssetType.find({ active: true }).sort({ name: 1 }).lean(), 'asset', transport, state);
    if (field === 'LOCATION') await locationChoices(state, phone, transport);
    if (field === 'DESCRIPTION') await transport.text(phone, 'Send the revised description.');
    return;
  }
  if (state.step === 'STATUS_CODE') {
    await transport.text(phone, await ticketStatus(user, raw.toUpperCase())); state.step = 'MENU'; await persist(state); await menu(phone, transport); return;
  }
  if (state.step === 'INFO_CODE') {
    const ticket = await Ticket.findOne({ id: raw.toUpperCase(), creatorId: user.id }).lean();
    if (!ticket) { await transport.text(phone, 'Ticket not found in your account. Try again or reply Cancel.'); return; }
    state.draft = { ticketCode: ticket.id }; state.step = 'INFO_TEXT'; await persist(state); await transport.text(phone, 'Send the information to add to this ticket.'); return;
  }
  if (state.step === 'INFO_TEXT') {
    const body = message.text?.body?.trim();
    if (!body) { await transport.text(phone, 'Send a text update, or reply Cancel.'); return; }
    await tickets.addMessage(plain(user), state.draft.ticketCode, body, 'PUBLIC');
    state.step = 'MENU'; state.draft = {}; await persist(state); await transport.text(phone, 'Information added to your ticket.'); await menu(phone, transport);
  }
}
async function processWebhook(payload, dependencies = {}) {
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const value = change.value || {};
    if (graph.phoneNumberId && value.metadata?.phone_number_id && value.metadata.phone_number_id !== graph.phoneNumberId) continue;
    for (const message of value.messages || []) {
      if (!message.id) continue;
      try { await InboundMessage.create({ id: message.id }); }
      catch (cause) { if (cause.code === 11000) continue; throw cause; }
      try { await handleMessage(message, dependencies); }
      catch (cause) { await InboundMessage.deleteOne({ id: message.id }); throw cause; }
    }
  }
}
async function notifyStatus(ticket) {
  if (!graph.accessToken || !graph.phoneNumberId) return;
  const user = await User.findOne({ id: ticket.creatorId, role: 'LAB_ASSISTANT', status: 'ACTIVE' }).lean();
  if (!user?.phoneE164) return;
  if (graph.statusTemplate) {
    await send(user.phoneE164, { type: 'template', template: { name: graph.statusTemplate, language: { code: 'en_US' }, components: [{ type: 'body', parameters: [{ type: 'text', text: ticket.id }, { type: 'text', text: ticket.status.replace(/_/g, ' ') }] }] } });
  } else {
    await sendText(user.phoneE164, `${ticket.id} is now ${ticket.status.replace(/_/g, ' ')}. Open the portal to review details or confirm the resolution.`);
  }
}
module.exports = { handleMessage, processWebhook, notifyStatus, send, downloadMedia, listPayload, buttonPayload };
