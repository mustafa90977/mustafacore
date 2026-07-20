import {
  ConnectionOrchestrator,
  DbContext,
  ConsoleLogger,
  InstanceRepository,
  SessionRepository,
  CustomerRepository,
  ConversationRepository,
  MessageRepository,
  InMemoryEventBus,
  CustomerRepositoryAdapter,
  ConversationRepositoryAdapter,
  MessageRepositoryAdapter,
} from '@wacore/infrastructure';
import { InboundMessageHandler } from '@wacore/commerce-core';
import { EventNames } from '@wacore/shared';

let _orchestrator: ConnectionOrchestrator | null = null;

export async function getOrchestrator(): Promise<ConnectionOrchestrator> {
  if (_orchestrator) return _orchestrator;

  const logger = new ConsoleLogger({ level: 'info', context: { service: 'dashboard' } });
  const db = new DbContext();
  const instanceRepo = new InstanceRepository(db);
  const sessionRepo = new SessionRepository(db);
  const customerRepo = new CustomerRepository(db);
  const conversationRepo = new ConversationRepository(db);
  const messageRepo = new MessageRepository(db);

  const eventBus = new InMemoryEventBus();
  await eventBus.start();

  const customerAdapter = new CustomerRepositoryAdapter(customerRepo);
  const conversationAdapter = new ConversationRepositoryAdapter(conversationRepo);
  const messageAdapter = new MessageRepositoryAdapter(messageRepo);

  const inboundHandler = new InboundMessageHandler({
    logger,
    customerRepo: customerAdapter,
    conversationRepo: conversationAdapter,
    messageRepo: messageAdapter,
  });

  eventBus.subscribe(EventNames.MESSAGE_RECEIVED, inboundHandler.handleIncomingMessage.bind(inboundHandler));

  _orchestrator = new ConnectionOrchestrator(
    logger,
    {
      sessionConfig: {
        persistence: { baseFolder: './auth' },
      },
    },
    instanceRepo,
    sessionRepo,
    eventBus,
  );

  return _orchestrator;
}
