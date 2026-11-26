import { distance } from './core.js';

// Manually reviewed evidence, not a live opening-status feed. A changed OSM
// identity, location or schedule must not inherit a previous verification,
// and an old check stops vouching for the hours: schedules change.
const checkValidDays = 90;
const evidence = {
  'node/1369465698': {
    name: 'Yliopiston apteekki',
    lat: 60.169575,
    lon: 24.939536,
    hours: '08:00-24:00',
    address: 'Mannerheimintie 5, Helsinki',
    url: 'https://www.yliopistonapteekki.fi/yhteystiedot/helsinki-keskusta',
    checked: '2026-11-26',
  },
  'node/11771777459': {
    name: 'Apteekki CityCenter',
    lat: 60.170001,
    lon: 24.941615,
    hours: 'Mo-Fr 08:00-19:00; Sa 10:00-17:00; Su off',
    address: 'Kaivokatu 8, Helsinki',
    url: 'https://citycenter.fi/liikkeet/apteekki-citycenter/',
    checked: '2026-11-26',
  },
};

/**
 * The reviewed source for a pharmacy, or null. `checked` is the review date only while the mapped hours still
 * match the reviewed ones and the review is younger than ninety days; otherwise only the link remains.
 */
export function reviewedDetails(pharmacy, now = Date.now()) {
  const entry = evidence[pharmacy.id];
  if (!entry || pharmacy.name !== entry.name || distance(pharmacy, entry) > 15) return null;
  const age = now - Date.parse(entry.checked);
  const current = age >= 0 && age <= checkValidDays * 86_400_000;
  return {
    address: pharmacy.address || entry.address,
    url: entry.url,
    checked: pharmacy.hours === entry.hours && current ? entry.checked : null,
  };
}

// A nameless, entirely unannotated point very close to a named pharmacy is
// ambiguous. Keep it searchable; proximity alone does not prove identity.
export function possibleDuplicate(pharmacy, results) {
  return (
    !pharmacy.name.trim() &&
    !pharmacy.address.trim() &&
    !pharmacy.hours.trim() &&
    results.some(other => other.id !== pharmacy.id && other.name.trim() && distance(pharmacy, other) <= 10)
  );
}
