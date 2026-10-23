import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { Role, TicketSource } from '../common/enums';
import {
  AssignDto,
  AttachmentInput,
  ChangeStatusDto,
  CreateTicketDto,
  EscalateDto,
  EscalationsQuery,
  FeedbackDto,
  ListTicketsQuery,
  MessageDto,
  ParseTicketCodePipe,
  PriorityDto,
} from './dto';
import { EscalationStatus } from './schemas/escalation.schema';
import { TicketsService } from './tickets.service';

@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** Raise a ticket from the portal. Send an Idempotency-Key header (any UUID) to make retries safe. */
  @Post('tickets')
  @Roles(Role.LAB_ASSISTANT, Role.MAIN_ADMIN)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    return this.tickets.create(user, dto, { source: TicketSource.PORTAL, idempotencyKey, ip: req.ip });
  }

  /** Role-scoped list: Main Admin all, Sub-Admin assigned, Lab Assistant own. */
  @Get('tickets')
  list(@CurrentUser() user: AuthUser, @Query() q: ListTicketsQuery) {
    return this.tickets.list(user, q);
  }

  /** Dashboard counts, scoped the same way as the list. */
  @Get('tickets/summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.tickets.summary(user);
  }

  @Get('tickets/:code')
  get(@CurrentUser() user: AuthUser, @Param('code', ParseTicketCodePipe) code: string) {
    return this.tickets.get(user, code);
  }

  @Patch('tickets/:code/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ) {
    return this.tickets.changeStatus(user, code, dto.to, dto.note, { ip: req.ip });
  }

  /** Lab assistant confirms the fix (→ CLOSED) or disputes it with a reason (→ REOPENED). */
  @Post('tickets/:code/feedback')
  @Roles(Role.LAB_ASSISTANT)
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: FeedbackDto,
    @Req() req: Request,
  ) {
    return this.tickets.feedback(user, code, dto.decision, dto.note, { ip: req.ip });
  }

  /** Public update, or (staff only) an internal note. */
  @Post('tickets/:code/messages')
  message(@CurrentUser() user: AuthUser, @Param('code', ParseTicketCodePipe) code: string, @Body() dto: MessageDto) {
    return this.tickets.addMessage(user, code, dto.body, dto.visibility);
  }

  @Post('tickets/:code/attachments')
  attach(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: AttachmentInput,
    @Req() req: Request,
  ) {
    return this.tickets.addAttachment(user, code, dto, { ip: req.ip });
  }

  @Patch('tickets/:code/assignee')
  @Roles(Role.MAIN_ADMIN)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: AssignDto,
    @Req() req: Request,
  ) {
    return this.tickets.assign(user, code, new Types.ObjectId(dto.assigneeId), dto.reason, { ip: req.ip });
  }

  @Patch('tickets/:code/priority')
  @Roles(Role.MAIN_ADMIN, Role.SUB_ADMIN)
  priority(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: PriorityDto,
    @Req() req: Request,
  ) {
    return this.tickets.changePriority(user, code, dto.priority, dto.reason, { ip: req.ip });
  }

  /** Sub-Admin asks the Main Admin to reassign / intervene. */
  @Post('tickets/:code/escalations')
  @Roles(Role.SUB_ADMIN)
  escalate(
    @CurrentUser() user: AuthUser,
    @Param('code', ParseTicketCodePipe) code: string,
    @Body() dto: EscalateDto,
    @Req() req: Request,
  ) {
    return this.tickets.escalate(user, code, dto.reason, { ip: req.ip });
  }

  @Get('admin/escalations')
  @Roles(Role.MAIN_ADMIN)
  escalations(@Query() q: EscalationsQuery) {
    return this.tickets.listEscalations(q.status as EscalationStatus | undefined);
  }
}
