import {
  ConnectionOrchestrator,
  DbContext,
  ConsoleLogger,
  InstanceRepository,
  SessionRepository,
  CustomerRepository,
  ConversationRepository,
  MessageRepository,
  InboundMessageOrchestrator,
} from '@wacore/infrastructure';

let _orchestrator: ConnectionOrchestrator | null = null;

export function getOrchestrator(): ConnectionOrchestrator {
  if (_orchestrator) return _orchestrator;

  const logger = new ConsoleLogger({ level: 'info', context: { service: 'dashboard' } });
  const db = new DbContext();
  const instanceRepo = new InstanceRepository(db);
  const sessionRepo = new SessionRepository(db);
  const customerRepo = new CustomerRepository(db);
  const conversationRepo = new ConversationRepository(db);
  const messageRepo = new MessageRepository(db);

  const messageOrchestrator = new InboundMessageOrchestrator(
    logger,
    customerRepo,
    conversationRepo,
    messageRepo,
    instanceRepo,
  );

  _orchestrator = new ConnectionOrchestrator(
    logger,
    {
      sessionConfig: {
        persistence: { baseFolder: './auth' },
      },
    },
    instanceRepo,
    sessionRepo,
    messageOrchestrator,
  );

  return _orchestrator;
}
