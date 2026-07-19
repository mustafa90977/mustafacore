import { AggregateRoot, BaseEntityProps, UniqueId, generateId } from '@wacore/shared';
import { Money } from '../value-objects/money';

export interface ProductProps extends BaseEntityProps {
  storeId: UniqueId;
  externalId?: string;
  name: string;
  description?: string;
  sku?: string;
  price: Money;
  compareAtPrice?: Money;
  costPrice?: Money;
  inventoryQuantity: number;
  trackInventory: boolean;
  isActive: boolean;
  media: ProductMedia[];
  attributes?: Record<string, unknown>;
  tags: string[];
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface ProductMedia {
  url: string;
  alt?: string;
  type: 'image' | 'video';
}

export class Product extends AggregateRoot<ProductProps> {
  private constructor(props: ProductProps) {
    super(props);
  }

  static create(props: {
    storeId: UniqueId;
    name: string;
    description?: string;
    sku?: string;
    price: Money;
    compareAtPrice?: Money;
    costPrice?: Money;
    inventoryQuantity?: number;
    trackInventory?: boolean;
  }): Product {
    return new Product({
      id: generateId(),
      storeId: props.storeId,
      name: props.name,
      description: props.description,
      sku: props.sku,
      price: props.price,
      compareAtPrice: props.compareAtPrice,
      costPrice: props.costPrice,
      inventoryQuantity: props.inventoryQuantity ?? 0,
      trackInventory: props.trackInventory ?? false,
      isActive: true,
      media: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  get storeId(): UniqueId {
    return this.props.storeId;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get sku(): string | undefined {
    return this.props.sku;
  }

  get price(): Money {
    return this.props.price;
  }

  get compareAtPrice(): Money | undefined {
    return this.props.compareAtPrice;
  }

  get costPrice(): Money | undefined {
    return this.props.costPrice;
  }

  get inventoryQuantity(): number {
    return this.props.inventoryQuantity;
  }

  get trackInventory(): boolean {
    return this.props.trackInventory;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get media(): ProductMedia[] {
    return this.props.media;
  }

  get attributes(): Record<string, unknown> | undefined {
    return this.props.attributes;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get weight(): number | undefined {
    return this.props.weight;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get inStock(): boolean {
    if (!this.props.trackInventory) return true;
    return this.props.inventoryQuantity > 0;
  }

  get hasDiscount(): boolean {
    if (!this.props.compareAtPrice) return false;
    return this.props.price.isGreaterThan(this.props.compareAtPrice);
  }

  updatePrice(price: Money): void {
    this.props.price = price;
    this.touch();
  }

  updateInventory(quantity: number): void {
    this.props.inventoryQuantity = quantity;
    this.touch();
  }

  decrementInventory(quantity: number): void {
    if (this.props.trackInventory && this.props.inventoryQuantity < quantity) {
      throw new Error('Insufficient inventory');
    }
    this.props.inventoryQuantity -= quantity;
    this.touch();
  }

  incrementInventory(quantity: number): void {
    this.props.inventoryQuantity += quantity;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  addMedia(media: ProductMedia): void {
    this.props.media.push(media);
    this.touch();
  }

  removeMedia(url: string): void {
    this.props.media = this.props.media.filter((m) => m.url !== url);
    this.touch();
  }

  addTag(tag: string): void {
    if (!this.props.tags.includes(tag)) {
      this.props.tags.push(tag);
      this.touch();
    }
  }

  removeTag(tag: string): void {
    const index = this.props.tags.indexOf(tag);
    if (index > -1) {
      this.props.tags.splice(index, 1);
      this.touch();
    }
  }

  protected toProps(): ProductProps {
    return {
      id: this.id,
      storeId: this.props.storeId,
      externalId: this.props.externalId,
      name: this.props.name,
      description: this.props.description,
      sku: this.props.sku,
      price: this.props.price,
      compareAtPrice: this.props.compareAtPrice,
      costPrice: this.props.costPrice,
      inventoryQuantity: this.props.inventoryQuantity,
      trackInventory: this.props.trackInventory,
      isActive: this.props.isActive,
      media: [...this.props.media],
      attributes: this.props.attributes,
      tags: [...this.props.tags],
      weight: this.props.weight,
      metadata: this.props.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
