import { Prisma } from '@prisma/client';
import { RepositoryError } from '@wacore/shared';

export function mapPrismaError(error: Error, modelName: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new RepositoryError(
          `Unique constraint violation on ${modelName}: ${JSON.stringify(error.meta?.target)}`,
        );
      case 'P2025':
        return new RepositoryError(
          `Record not found in ${modelName}: ${error.meta?.cause || 'unknown'}`,
        );
      case 'P2003':
        return new RepositoryError(
          `Foreign key constraint violation on ${modelName}: ${JSON.stringify(error.meta?.field_name)}`,
        );
      case 'P2014':
        return new RepositoryError(
          `Required relation violation on ${modelName}`,
        );
      default:
        return new RepositoryError(
          `Database error on ${modelName} [${error.code}]: ${error.message}`,
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new RepositoryError(
      `Validation error on ${modelName}: ${error.message}`,
    );
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new RepositoryError(
      `Internal database error on ${modelName}`,
    );
  }

  return error;
}
