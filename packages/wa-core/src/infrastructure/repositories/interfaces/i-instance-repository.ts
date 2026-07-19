import { UniqueId } from '@wacore/shared';
import { WhatsAppInstance } from '../../../domain/entities/whatsapp-instance';

export interface IInstanceRepository {
  findById(id: UniqueId): Promise<WhatsAppInstance | null>;
  findByWorkspaceId(workspaceId: UniqueId): Promise<WhatsAppInstance[]>;
  findByStoreId(storeId: UniqueId): Promise<WhatsAppInstance | null>;
  findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<WhatsAppInstance | null>;
  save(instance: WhatsAppInstance): Promise<void>;
  update(instance: WhatsAppInstance): Promise<void>;
  delete(id: UniqueId): Promise<void>;
}
