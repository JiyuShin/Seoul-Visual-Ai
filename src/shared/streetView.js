export const STREET_VIEW_URL = 'https://quiet-street-360.hello-ccid.chatgpt.site/';

export function streetViewUrl(district) {
  if (!district?.id) return STREET_VIEW_URL;
  const url = new URL(STREET_VIEW_URL);
  url.searchParams.set('district', String(district.id));
  if (district.name) url.searchParams.set('name', district.name);
  return url.toString();
}
