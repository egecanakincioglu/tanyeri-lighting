export type VisitorPlace = { country: string | null; city: string | null };

const MAX_CITY_LENGTH = 100;

// The host's request headers are the only source of the place (no lookup library). Vercel sends the country as an
// ISO 3166 code and the city URL-encoded; a missing or odd value is stored as null and shown as "unknown".
export function readVisitorPlace(headers: Headers): VisitorPlace {
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
