import { EventName, EventMetadata } from '@wacore/shared';

export interface EventRegistration {
  eventType: EventName | string;
  version: number;
  aggregateType: string;
  source: string;
  description?: string;
  schemaHash?: string;
}

export interface EventVersionInfo {
  version: number;
  registration: EventRegistration;
  registeredAt: Date;
}

export class EventRegistry {
  private readonly _registrations: Map<string, EventVersionInfo[]> = new Map();

  register(registration: EventRegistration): void {
    const versions = this._registrations.get(registration.eventType) || [];
    const existing = versions.find((v) => v.version === registration.version);
    if (existing) {
      throw new Error(
        `Event '${registration.eventType}' version ${registration.version} is already registered`,
      );
    }
    versions.push({
      version: registration.version,
      registration,
      registeredAt: new Date(),
    });
    versions.sort((a, b) => a.version - b.version);
    this._registrations.set(registration.eventType, versions);
  }

  getRegistration(eventType: string, version?: number): EventRegistration | undefined {
    const versions = this._registrations.get(eventType);
    if (!versions || versions.length === 0) return undefined;
    if (version !== undefined) {
      return versions.find((v) => v.version === version)?.registration;
    }
    return versions[versions.length - 1].registration;
  }

  isRegistered(eventType: string): boolean {
    return this._registrations.has(eventType);
  }

  getVersions(eventType: string): number[] {
    const versions = this._registrations.get(eventType) || [];
    return versions.map((v) => v.version);
  }

  getLatestVersion(eventType: string): number | undefined {
    const versions = this.getVersions(eventType);
    return versions.length > 0 ? Math.max(...versions) : undefined;
  }

  getAllRegistrations(): EventRegistration[] {
    const all: EventRegistration[] = [];
    for (const versions of this._registrations.values()) {
      for (const v of versions) {
        all.push(v.registration);
      }
    }
    return all;
  }

  getRegistrationsBySource(source: string): EventRegistration[] {
    return this.getAllRegistrations().filter((r) => r.source === source);
  }

  getRegistrationsByAggregate(aggregateType: string): EventRegistration[] {
    return this.getAllRegistrations().filter((r) => r.aggregateType === aggregateType);
  }

  validateEventMetadata(eventType: string, metadata: EventMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const registration = this.getRegistration(eventType, metadata.version);
    if (!registration) {
      errors.push(`No registration found for event '${eventType}' version ${metadata.version}`);
    }
    if (!metadata.timestamp) {
      errors.push('Event metadata missing timestamp');
    }
    return { valid: errors.length === 0, errors };
  }
}
