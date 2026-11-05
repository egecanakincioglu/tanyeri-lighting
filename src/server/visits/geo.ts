import { isVercel } from '../env.ts';

export type VisitorPlace = { country: string | null; city: string | null };

const MAX_CITY_LENGTH = 100;

// The place comes from host headers only: Vercel sends an ISO 3166 country code and a URL-encoded city.
// A missing or odd value is stored as null. Ignored off Vercel, where anyone can send them.
export function readVisitorPlace(headers: Headers): VisitorPlace {
  if (!isVercel()) return { country: null, city: null };
  const country = headers.get('x-vercel-ip-country')?.trim().toUpperCase() ?? '';
  const rawCity = headers.get('x-vercel-ip-city');
  let city = '';
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim();
    } catch {
      city = '';
    }
  }
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    city: city && city.length <= MAX_CITY_LENGTH ? city : null,
  };
}
