import { UniqueId, PaginatedResult, createPaginatedResult } from '@wacore/shared';
import { Customer } from '@wacore/commerce-core';
import type { ICustomerRepository } from '@wacore/commerce-core';
import { ICustomerRepository as InfraCustomerRepo } from '../repositories/customer.repository';
import { Money } from '@wacore/commerce-core';

function toCustomerEntity(data: any): Customer {
  return Customer.reconstitute({
    id: data.id,
    workspaceId: data.workspaceId,
    phoneNumber: data.phoneNumber,
    name: data.name ?? undefined,
    pushName: data.pushName ?? undefined,
    profilePictureUrl: data.profilePictureUrl ?? undefined,
    isBusiness: data.isBusiness ?? false,
    businessName: data.businessName ?? undefined,
    tags: data.tags ?? [],
    notes: data.notes ?? undefined,
    totalOrders: data.totalOrders ?? 0,
    totalSpent: Money.zero('USD'),
    lastInteractionAt: data.lastInteractionAt ?? undefined,
    metadata: data.metadata ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

function toPrismaData(customer: Customer): Record<string, unknown> {
  return {
    id: customer.id,
    workspaceId: customer.workspaceId,
    phoneNumber: customer.phoneNumber,
    name: customer.name ?? null,
    pushName: customer.pushName ?? null,
    profilePictureUrl: customer.profilePictureUrl ?? null,
    isBusiness: customer.isBusiness,
    businessName: customer.businessName ?? null,
    tags: customer.tags,
    notes: customer.notes ?? null,
    totalOrders: customer.totalOrders,
    lastInteractionAt: customer.lastInteractionAt ?? null,
    metadata: customer.metadata ?? undefined,
  };
}

export class CustomerRepositoryAdapter implements ICustomerRepository {
  constructor(private readonly _repo: InfraCustomerRepo) {}

  async findById(id: UniqueId): Promise<Customer | null> {
    const data = await this._repo.findById(id);
    return data ? toCustomerEntity(data) : null;
  }

  async findByPhoneNumber(workspaceId: UniqueId, phoneNumber: string): Promise<Customer | null> {
    const data = await this._repo.findByPhoneNumber(workspaceId, phoneNumber);
    return data ? toCustomerEntity(data) : null;
  }

  async findByWorkspaceId(_workspaceId: UniqueId): Promise<PaginatedResult<Customer>> {
    const result = await this._repo.findByWorkspaceId(_workspaceId);
    return createPaginatedResult(result.map(toCustomerEntity), 1, result.length, result.length);
  }

  async findByStoreId(_storeId: UniqueId): Promise<PaginatedResult<Customer>> {
    return createPaginatedResult([], 1, 0, 0);
  }

  async save(customer: Customer): Promise<void> {
    await this._repo.create(toPrismaData(customer));
  }

  async update(customer: Customer): Promise<void> {
    await this._repo.update(customer.id, toPrismaData(customer));
  }

  async delete(id: UniqueId): Promise<void> {
    await this._repo.delete(id);
  }

  async countByWorkspaceId(workspaceId: UniqueId): Promise<number> {
    return this._repo.countByWorkspaceId(workspaceId);
  }
}
