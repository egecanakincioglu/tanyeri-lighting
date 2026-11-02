'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createProject, deleteProject, listProjects, reorderProjects, updateProject } from '../content/projects.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['beforeImageUrl', 'afterImageUrl'] as const;

// The record as it is before a change, to know which files the change leaves behind.
async function findProject(id: string) {
  return (await listProjects()).find((item) => item.id === id);
}

function projectInput(formData: FormData) {
  return {
    title: formPair(formData, 'title'),
    description: formPair(formData, 'description'),
    beforeImageUrl: formText(formData, 'beforeImageUrl'),
    afterImageUrl: formText(formData, 'afterImageUrl'),
  };
}

export async function createProjectAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createProject(projectInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/projects' }));
  }
  return result;
}

export async function updateProjectAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findProject(id);
    const saved = await updateProject(id, projectInput(formData));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deleteProjectAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findProject(id);
    await deleteProject(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
    refresh();
  });
}

export async function reorderProjectsAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderProjects(ids);
    refresh();
  });
}
