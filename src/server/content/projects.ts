import type { Project as ProjectRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, InvalidOrderError, isRecordNotFound } from './errors.ts';
import { type Project, projectIdSchema, projectOrderSchema, projectSchema, type ProjectInput } from './schemas.ts';

function fromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    title: fromColumns('title', row),
    description: fromColumns('description', row),
    beforeImageUrl: row.beforeImageUrl,
    afterImageUrl: row.afterImageUrl,
  };
}

function toColumnsOf(project: ProjectInput) {
  return {
    ...toColumns('title', project.title),
    ...toColumns('description', project.description),
    beforeImageUrl: project.beforeImageUrl,
    afterImageUrl: project.afterImageUrl,
  };
}

export async function listProjects(): Promise<Project[]> {
  const rows = await getDb().project.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// An unknown id is a missing project, not an error.
export async function getProject(id: unknown): Promise<Project | null> {
  const row = await getDb().project.findUnique({ where: { id: projectIdSchema.parse(id) } });
  return row ? fromRow(row) : null;
}

export async function createProject(input: unknown): Promise<Project> {
  assertWritable();
  const columns = toColumnsOf(projectSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.project.aggregate({ _max: { sortOrder: true } });
    return tx.project.create({ data: { ...columns, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  });
  return fromRow(row);
}

export async function updateProject(id: unknown, input: unknown): Promise<Project> {
  assertWritable();
  const projectId = projectIdSchema.parse(id);
  const columns = toColumnsOf(projectSchema.parse(input));
  try {
    return fromRow(await getDb().project.update({ where: { id: projectId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Project');
    throw error;
  }
}

export async function deleteProject(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().project.deleteMany({ where: { id: projectIdSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Project');
}

// Anything but the complete list changes nothing.
export async function reorderProjects(ids: unknown): Promise<void> {
  assertWritable();
  const order = projectOrderSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    const existing = await tx.project.findMany({ select: { id: true } });
    const known = new Set(existing.map((project) => project.id));
    if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
      throw new InvalidOrderError();
    }
    for (const [sortOrder, id] of order.entries()) {
      await tx.project.update({ where: { id }, data: { sortOrder } });
    }
  });
}
