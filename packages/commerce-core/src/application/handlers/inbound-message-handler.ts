import { UniqueId, DomainEvent, ILogger } from '@wacore/shared';
import { Customer } from '../../domain/entities/customer';
import { Conversation } from '../../domain/entities/conversation';
import { ICustomerRepository } from '../../infrastructure/repositories/interfaces/i-customer-repository';
import { IConversationRepository } from '../../infrastructure/repositories/interfaces/i-conversation-repository';
import { IMessageRepository } from '../../infrastructure/repositories/interfaces/i-message-repository';

export interface InboundMessageHandlerDeps {
  logger: ILogger;
  customerRepo: ICustomerRepository;
  conversationRepo: IConversationRepository;
  messageRepo: IMessageRepository;
}

interface MessageReceivedPayload {
  instanceId: UniqueId;
  storeId?: UniqueId;
  externalId: string;
  from: string;
  type: string;
  content: Record<string, unknown>;
  timestamp: Date;
  pushName?: string;
}

function extractPhoneFromJid(jid: string): string {
  return jid.replace(/@.*$/, '');
}

export class InboundMessageHandler {
  private readonly _logger: ILogger;
  private readonly _customerRepo: ICustomerRepository;
  private readonly _conversationRepo: IConversationRepository;
  private readonly _messageRepo: IMessageRepository;

  constructor(deps: InboundMessageHandlerDeps) {
    this._logger = deps.logger.child({ module: 'InboundMessageHandler' });
    this._customerRepo = deps.customerRepo;
    this._conversationRepo = deps.conversationRepo;
    this._messageRepo = deps.messageRepo;
  }

  async handleIncomingMessage(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as MessageReceivedPayload;
    const workspaceId = event.workspaceId;

    if (!workspaceId) {
      this._logger.warn('MESSAGE_RECEIVED event missing workspaceId', {
        eventId: event.eventId,
      });
      return;
    }

    if (!payload.storeId) {
      this._logger.warn('MESSAGE_RECEIVED event missing storeId', {
        instanceId: payload.instanceId,
      });
      return;
    }

    const phoneNumber = extractPhoneFromJid(payload.from);
    const customer = await this.findOrCreateCustomer(workspaceId, phoneNumber, payload);

    const conversation = await this.findOrCreateConversation(
      payload.instanceId,
      customer.id,
      payload.storeId,
    );

    const textContent = (payload.content as Record<string, unknown>)?.text || '';

    await this._messageRepo.save({
      id: payload.externalId,
      instanceId: payload.instanceId,
      externalId: payload.externalId,
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: payload.type,
      content: payload.content,
      status: 'DELIVERED',
      timestamp: payload.timestamp,
      metadata: { rawPayload: payload.content },
    });

    conversation.recordMessage(String(textContent));
    await this._conversationRepo.update(conversation);

    customer.updateLastInteraction();
    await this._customerRepo.update(customer);

    this._logger.info('Inbound message processed', {
      instanceId: payload.instanceId,
      customerId: customer.id,
      conversationId: conversation.id,
    });
  }

  private async findOrCreateCustomer(
    workspaceId: UniqueId,
    phoneNumber: string,
    payload: MessageReceivedPayload,
  ): Promise<Customer> {
    let customer = await this._customerRepo.findByPhoneNumber(workspaceId, phoneNumber);

    if (!customer) {
      customer = Customer.create({
        workspaceId,
        phoneNumber,
        pushName: payload.pushName,
      });
      await this._customerRepo.save(customer);

      this._logger.info('Customer created', {
        customerId: customer.id,
        phoneNumber,
      });
    } else {
      customer.updateLastInteraction();
      await this._customerRepo.update(customer);
    }

    return customer;
  }

  private async findOrCreateConversation(
    instanceId: UniqueId,
    customerId: UniqueId,
    storeId: UniqueId,
  ): Promise<Conversation> {
    let conversation = await this._conversationRepo.findByInstanceIdAndCustomerId(
      instanceId,
      customerId,
    );

    if (!conversation) {
      conversation = Conversation.create({
        instanceId,
        customerId,
        storeId,
      });
      await this._conversationRepo.save(conversation);

      this._logger.info('Conversation created', {
        conversationId: conversation.id,
        instanceId,
        customerId,
      });
    }

    return conversation;
  }
}
