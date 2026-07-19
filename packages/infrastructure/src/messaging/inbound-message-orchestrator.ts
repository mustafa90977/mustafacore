import { UniqueId, ILogger } from '@wacore/shared';
import { MessageType, IncomingMessage } from '@wacore/wa-core';
import { ICustomerRepository } from '../repositories/customer.repository';
import { IConversationRepository } from '../repositories/conversation.repository';
import { IMessageRepository } from '../repositories/message.repository';
import { IInstanceRepository } from '../repositories/instance.repository';

function extractPhoneFromJid(jid: string): string {
  return jid.replace(/@.*$/, '');
}

export class InboundMessageOrchestrator {
  private readonly _logger: ILogger;
  private readonly _customerRepo: ICustomerRepository;
  private readonly _conversationRepo: IConversationRepository;
  private readonly _messageRepo: IMessageRepository;
  private readonly _instanceRepo: IInstanceRepository;

  constructor(
    logger: ILogger,
    customerRepo: ICustomerRepository,
    conversationRepo: IConversationRepository,
    messageRepo: IMessageRepository,
    instanceRepo: IInstanceRepository,
  ) {
    this._logger = logger.child({ module: 'InboundMessageOrchestrator' });
    this._customerRepo = customerRepo;
    this._conversationRepo = conversationRepo;
    this._messageRepo = messageRepo;
    this._instanceRepo = instanceRepo;
  }

  async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    if (message.type !== MessageType.TEXT) {
      this._logger.debug('Ignoring non-text message', {
        instanceId: message.instanceId,
        type: message.type,
      });
      return;
    }

    const instance = await this._instanceRepo.findById(message.instanceId);
    if (!instance) {
      this._logger.warn('Instance not found for incoming message', {
        instanceId: message.instanceId,
      });
      return;
    }

    const workspaceId = instance.workspaceId;
    const storeId = instance.storeId;
    const phoneNumber = extractPhoneFromJid(message.from);

    const customer = await this.findOrCreateCustomer(workspaceId, phoneNumber, message);

    if (!storeId) {
      this._logger.warn('Instance has no storeId, cannot create conversation', {
        instanceId: message.instanceId,
      });
      return;
    }

    const conversation = await this.findOrCreateConversation(
      message.instanceId,
      customer.id,
      storeId,
    );

    const textContent = (message.content as Record<string, unknown>).text || '';

    const saved = await this._messageRepo.create({
      id: message.externalId,
      instanceId: message.instanceId,
      externalId: message.externalId,
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: message.type,
      content: message.content,
      status: 'DELIVERED',
      timestamp: message.timestamp,
      metadata: { rawPayload: message.content },
    });

    await this._conversationRepo.update(conversation.id, {
      lastMessageAt: message.timestamp,
      lastMessagePreview: String(textContent).substring(0, 100),
    });

    this._logger.info('Inbound message processed', {
      instanceId: message.instanceId,
      messageId: saved.id,
      customerId: customer.id,
      conversationId: conversation.id,
    });
  }

  private async findOrCreateCustomer(
    workspaceId: UniqueId,
    phoneNumber: string,
    message: IncomingMessage,
  ): Promise<any> {
    let customer = await this._customerRepo.findByPhoneNumber(workspaceId, phoneNumber);

    if (!customer) {
      customer = await this._customerRepo.create({
        workspaceId,
        phoneNumber,
        pushName: (message.content as Record<string, unknown>).pushName || undefined,
        lastInteractionAt: message.timestamp,
      });

      this._logger.info('Customer created', {
        customerId: customer.id,
        phoneNumber,
      });
    } else {
      await this._customerRepo.update(customer.id, {
        lastInteractionAt: message.timestamp,
      });
    }

    return customer;
  }

  private async findOrCreateConversation(
    instanceId: UniqueId,
    customerId: UniqueId,
    storeId: UniqueId,
  ): Promise<any> {
    let conversation = await this._conversationRepo.findByInstanceIdAndCustomerId(
      instanceId,
      customerId,
    );

    if (!conversation) {
      conversation = await this._conversationRepo.create({
        instanceId,
        customerId,
        storeId,
        status: 'ACTIVE',
      });

      this._logger.info('Conversation created', {
        conversationId: conversation.id,
        instanceId,
        customerId,
      });
    }

    return conversation;
  }
}
