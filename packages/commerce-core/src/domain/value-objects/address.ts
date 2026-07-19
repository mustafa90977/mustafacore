import { ValueObject } from '@wacore/shared';

export interface AddressProps {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  complement?: string;
  neighborhood?: string;
}

export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  static create(props: AddressProps): Address {
    return new Address(props);
  }

  get street(): string {
    return this.props.street;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  get postalCode(): string {
    return this.props.postalCode;
  }

  get country(): string {
    return this.props.country;
  }

  get complement(): string | undefined {
    return this.props.complement;
  }

  get neighborhood(): string | undefined {
    return this.props.neighborhood;
  }

  get fullAddress(): string {
    const parts = [
      this.props.street,
      this.props.complement,
      this.props.neighborhood,
      this.props.city,
      this.props.state,
      this.props.postalCode,
      this.props.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  toString(): string {
    return this.fullAddress;
  }
}
