import { getDb } from '../db.ts';

export type PanelCounts = {
  products: number;
  categories: number;
  catalogs: number;
  projects: number;
  references: number;
  services: number;
  blogPosts: number;
  messages: number;
  unreadMessages: number;
};

export async function getPanelCounts(): Promise<PanelCounts> {
  const db = getDb();
  const [products, categories, catalogs, projects, references, services, blogPosts, messages, unreadMessages] =
    await Promise.all([
      db.product.count(),
      db.category.count(),
      db.catalog.count(),
      db.project.count(),
      db.reference.count(),
      db.service.count(),
      db.blogPost.count(),
      db.contactMessage.count(),
      db.contactMessage.count({ where: { readAt: null } }),
    ]);
  return { products, categories, catalogs, projects, references, services, blogPosts, messages, unreadMessages };
}

export function countUnreadMessages(): Promise<number> {
  return getDb().contactMessage.count({ where: { readAt: null } });
}
