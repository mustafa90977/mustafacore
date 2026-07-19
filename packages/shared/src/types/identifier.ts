import { randomUUID } from 'crypto';

export type UniqueId = string;

export function generateId(): UniqueId {
  return randomUUID();
}

export function isValidId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
