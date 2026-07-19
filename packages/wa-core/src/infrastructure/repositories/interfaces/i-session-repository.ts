import { UniqueId } from '@wacore/shared';
import { WhatsAppSession } from '../../../domain/entities/whatsapp-session';

export interface ISessionRepository {
  findActiveByInstanceId(instanceId: UniqueId): Promise<WhatsAppSession | null>;
  findById(id: UniqueId): Promise<WhatsAppSession | null>;
  save(session: WhatsAppSession): Promise<void>;
  update(session: WhatsAppSession): Promise<void>;
  delete(id: UniqueId): Promise<void>;
  revokeAllForInstance(instanceId: UniqueId): Promise<void>;
}
