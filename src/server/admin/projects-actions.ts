'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createProject, deleteProject, reorderProjects, updateProject } from '../content/projects.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

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
    await updateProject(formText(formData, 'id'), projectInput(formData));
    refresh();
  });
}

export async function deleteProjectAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteProject(formText(formData, 'id'));
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
