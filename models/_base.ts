/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma } from "@prisma/client";

type JsonFieldNames<T> = ReadonlyArray<keyof T & string>;

function applyJsonFields<T extends Record<string, unknown>>(
  record: T,
  jsonFields: JsonFieldNames<T>,
): T {
  const next = { ...record };

  for (const field of jsonFields) {
    next[field] = next[field] as Prisma.JsonValue;
  }

  return next;
}

function applyJsonFieldsToMany<T extends Record<string, unknown>>(
  records: T[],
  jsonFields: JsonFieldNames<T>,
): T[] {
  return records.map((record) => applyJsonFields(record, jsonFields));
}

export function createPrismaModel<T extends Record<string, unknown>>(
  delegate: any,
  jsonFields: JsonFieldNames<T> = [],
) {
  return {
    async findUnique(args: Record<string, unknown>) {
      const record = await delegate.findUnique(args);
      return record ? applyJsonFields<T>(record, jsonFields) : null;
    },
    async findFirst(args: Record<string, unknown>) {
      const record = await delegate.findFirst(args);
      return record ? applyJsonFields<T>(record, jsonFields) : null;
    },
    async findMany(args: Record<string, unknown> = {}) {
      const records = await delegate.findMany(args);
      return applyJsonFieldsToMany<T>(records, jsonFields);
    },
    async create(args: Record<string, unknown>) {
      const record = await delegate.create(args);
      return applyJsonFields<T>(record, jsonFields);
    },
    async update(args: Record<string, unknown>) {
      const record = await delegate.update(args);
      return applyJsonFields<T>(record, jsonFields);
    },
    async updateMany(args: Record<string, unknown>) {
      return delegate.updateMany(args);
    },
    async deleteMany(args: Record<string, unknown> = {}) {
      return delegate.deleteMany(args);
    },
    async count(args: Record<string, unknown> = {}) {
      return delegate.count(args);
    },
    async insertMany(records: Record<string, unknown>[]) {
      return Promise.all(records.map((data) => this.create({ data })));
    },
  };
}
