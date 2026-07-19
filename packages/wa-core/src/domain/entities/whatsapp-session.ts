import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { SessionStatus } from '../enums/session-status';

export interface WhatsAppSessionProps extends BaseEntityProps {
  instanceId: UniqueId;
  sessionId: string;
  status: SessionStatus;
  qrCode?: string;
  qrGeneratedAt?: Date;
  qrExpiresAt?: Date;
  authData?: Record<string, unknown>;
  isActive: boolean;
}

export class WhatsAppSession extends AggregateRoot<WhatsAppSessionProps> {
  private static readonly QR_EXPIRY_MS = 20 * 1000;

  private constructor(props: WhatsAppSessionProps) {
    super(props);
  }

  static create(props: { instanceId: UniqueId; sessionId: string }): WhatsAppSession {
    return new WhatsAppSession({
      id: generateId(),
      instanceId: props.instanceId,
      sessionId: props.sessionId,
      status: SessionStatus.QR_PENDING,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: WhatsAppSessionProps): WhatsAppSession {
    return new WhatsAppSession(props);
  }

  get instanceId(): UniqueId {
    return this.props.instanceId;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get status(): SessionStatus {
    return this.props.status;
  }

  get qrCode(): string | undefined {
    return this.props.qrCode;
  }

  get qrGeneratedAt(): Date | undefined {
    return this.props.qrGeneratedAt;
  }

  get qrExpiresAt(): Date | undefined {
    return this.props.qrExpiresAt;
  }

  get authData(): Record<string, unknown> | undefined {
    return this.props.authData;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get isQRExpired(): boolean {
    if (!this.props.qrExpiresAt) return true;
    return new Date() > this.props.qrExpiresAt;
  }

  setQRCode(qrCode: string): void {
    this.props.qrCode = qrCode;
    this.props.qrGeneratedAt = new Date();
    this.props.qrExpiresAt = new Date(Date.now() + WhatsAppSession.QR_EXPIRY_MS);
    this.props.status = SessionStatus.QR_PENDING;
    this.touch();
  }

  markQRScanned(): void {
    this.props.status = SessionStatus.QR_SCANNED;
    this.touch();
  }

  activate(authData: Record<string, unknown>): void {
    this.props.status = SessionStatus.ACTIVE;
    this.props.authData = authData;
    this.props.isActive = true;
    this.props.qrCode = undefined;
    this.touch();
  }

  revoke(): void {
    this.props.status = SessionStatus.REVOKED;
    this.props.isActive = false;
    this.touch();
  }

  expire(): void {
    this.props.status = SessionStatus.EXPIRED;
    this.props.isActive = false;
    this.touch();
  }

  fail(): void {
    this.props.status = SessionStatus.FAILED;
    this.props.isActive = false;
    this.touch();
  }

  protected toProps(): WhatsAppSessionProps {
    return {
      id: this.id,
      instanceId: this.props.instanceId,
      sessionId: this.props.sessionId,
      status: this.props.status,
      qrCode: this.props.qrCode,
      qrGeneratedAt: this.props.qrGeneratedAt,
      qrExpiresAt: this.props.qrExpiresAt,
      authData: this.props.authData,
      isActive: this.props.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
