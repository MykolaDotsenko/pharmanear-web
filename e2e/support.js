// Shared by the browser tests: a small live-provider fixture and the routes that keep tests off the catalog.
export const fixture = {
  elements: [
    { type: 'node', id: 1, lat: 60.47, lon: 22.28, tags: { amenity: 'pharmacy', name: 'Far pharmacy' } },
    {
      type: 'node',
      id: 2,
      lat: 60.452,
      lon: 22.267,
      tags: { amenity: 'pharmacy', name: 'Near pharmacy', 'addr:street': 'Example street' },
    },
  ],
};

/** The fixture with opening hours on the nearest pharmacy. */
export function withHours(hours) {
  const [far, near] = fixture.elements;
  return { elements: [far, { ...near, tags: { ...near.tags, opening_hours: hours } }] };
}

export const endpoint = /^https:\/\/(overpass-api\.de|overpass\.private\.coffee)\/api\/interpreter$/;
export const fulfill = (route, json) =>
  route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });

/** Keeps live-provider mocks independent of the production catalog. */
export async function withoutCatalog(page) {
  await page.route('**/data/current-finland-pharmacies.json', route => route.fulfill({ status: 404 }));
  await page.route('**/data/finland-pharmacies.json', route => route.fulfill({ status: 404 }));
}
