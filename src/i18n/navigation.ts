import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing.ts';

// Links and path hooks that add the language prefix and use the localized addresses.
export const { Link, usePathname, getPathname } = createNavigation(routing);
