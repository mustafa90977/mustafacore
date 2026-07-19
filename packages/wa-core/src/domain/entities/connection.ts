import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { ConnectionStatus } from '../enums/connection-status';

export interface ConnectionProps extends BaseEntityProps {
  instanceId: UniqueId;
  status: ConnectionStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  latency?: number;
  reconnectAttempts: number;
}

export class Connection extends AggregateRoot<ConnectionProps> {
  private constructor(props: ConnectionProps) {
    super(props);
  }

  static create(props: { instanceId: UniqueId }): Connection {
    return new Connection({
      id: generateId(),
      instanceId: props.instanceId,
      status: ConnectionStatus.DISCONNECTED,
      reconnectAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ConnectionProps): Connection {
    return new Connection(props);
  }

  get instanceId(): UniqueId {
    return this.props.instanceId;
  }

  get status(): ConnectionStatus {
    return this.props.status;
  }

  get connectedAt(): Date | undefined {
    return this.props.connectedAt;
  }

  get lastActivity(): Date | undefined {
    return this.props.lastActivity;
  }

  get latency(): number | undefined {
    return this.props.latency;
  }

  get reconnectAttempts(): number {
    return this.props.reconnectAttempts;
  }

  get isConnected(): boolean {
    return this.props.status === ConnectionStatus.CONNECTED;
  }

  connect(): void {
    this.props.status = ConnectionStatus.CONNECTED;
    this.props.connectedAt = new Date();
    this.props.reconnectAttempts = 0;
    this.touch();
  }

  disconnect(): void {
    this.props.status = ConnectionStatus.DISCONNECTED;
    this.touch();
  }

  reconnecting(): void {
    this.props.status = ConnectionStatus.RECONNECTING;
    this.props.reconnectAttempts++;
    this.touch();
  }

  updateLatency(latency: number): void {
    this.props.latency = latency;
    this.touch();
  }

  updateActivity(): void {
    this.props.lastActivity = new Date();
    this.touch();
  }

  protected toProps(): ConnectionProps {
    return {
      id: this.id,
      instanceId: this.props.instanceId,
      status: this.props.status,
      connectedAt: this.props.connectedAt,
      lastActivity: this.props.lastActivity,
      latency: this.props.latency,
      reconnectAttempts: this.props.reconnectAttempts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
