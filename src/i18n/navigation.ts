import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing.ts';

export const { Link, usePathname, getPathname } = createNavigation(routing);
