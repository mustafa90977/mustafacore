import {
  ConnectionOrchestrator,
  DbContext,
  ConsoleLogger,
  InstanceRepository,
  SessionRepository,
} from '@wacore/infrastructure';

let _orchestrator: ConnectionOrchestrator | null = null;

export function getOrchestrator(): ConnectionOrchestrator {
  if (_orchestrator) return _orchestrator;

  const logger = new ConsoleLogger({ level: 'info', context: { service: 'dashboard' } });
  const db = new DbContext();
  const instanceRepo = new InstanceRepository(db);
  const sessionRepo = new SessionRepository(db);

  _orchestrator = new ConnectionOrchestrator(
    logger,
    {
      sessionConfig: {
        persistence: { baseFolder: './auth' },
      },
    },
    instanceRepo,
    sessionRepo,
  );

  return _orchestrator;
}
