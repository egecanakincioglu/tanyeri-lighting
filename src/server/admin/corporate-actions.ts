'use server';

import { refresh } from 'next/cache';
import { guardAction } from '../auth/guard.ts';
import { updateAboutPage } from '../content/about-page.ts';
import { getSiteSettings, updateSiteSettings } from '../content/site-settings.ts';
import { createSocialLink, deleteSocialLink, reorderSocialLinks, updateSocialLink } from '../content/social-links.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

// The company screens: the business details with the social links, and the about page. The services validate again
// and refuse writes in the demo; the public pages read the database on every request, so refresh() only redraws the
// panel screen the action came from.

export async function updateSiteSettingsAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const logoUrl = formText(formData, 'logoUrl');
    const before = await getSiteSettings();
    const saved = await updateSiteSettings({
      siteName: formPair(formData, 'siteName'),
      logoUrl: logoUrl === '' ? null : logoUrl,
      phone: formText(formData, 'phone'),
      email: formText(formData, 'email'),
      address: formPair(formData, 'address'),
      workingHours: formPair(formData, 'workingHours'),
      serviceArea: formPair(formData, 'serviceArea'),
      languages: formPair(formData, 'languages'),
    });
    await discardChangedFiles(before, saved, ['logoUrl']);
    refresh();
  });
}

function socialLinkInput(formData: FormData) {
  return {
    platform: formText(formData, 'platform'),
    label: formPair(formData, 'label'),
    url: formText(formData, 'url'),
  };
}

export async function createSocialLinkAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await createSocialLink(socialLinkInput(formData));
    refresh();
  });
}

export async function updateSocialLinkAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await updateSocialLink(formText(formData, 'id'), socialLinkInput(formData));
    refresh();
  });
}

export async function deleteSocialLinkAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteSocialLink(formText(formData, 'id'));
    refresh();
  });
}

export async function reorderSocialLinksAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderSocialLinks(ids);
    refresh();
  });
}

export async function updateAboutPageAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await updateAboutPage({ body: formPair(formData, 'body'), vision: formPair(formData, 'vision') });
    refresh();
  });
}
