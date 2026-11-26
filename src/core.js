export const radii = [3000, 10000, 30000];
export const cities = { Turku: {lat:60.4518,lon:22.2666}, Helsinki:{lat:60.1699,lon:24.9384}, Tampere:{lat:61.4978,lon:23.7610}, Oulu:{lat:65.0121,lon:25.4651}, Vaasa:{lat:63.0951,lon:21.6165} };
export function validPoint(p){return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180;}
export function approximate(p){if(!validPoint(p)) throw new Error('invalid point');return {lat:Math.round(p.lat*100)/100,lon:Math.round(p.lon*100)/100};}
export function distance(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
export function query(center,radius){if(!validPoint(center)||!radii.includes(radius))throw new Error('invalid query');return `[out:json][timeout:15];nwr["amenity"="pharmacy"](around:${radius},${center.lat},${center.lon});out center;`;}
export function normalize(payload,origin){if(!payload||!Array.isArray(payload.elements)||payload.remark)throw new Error('incomplete response');const seen=new Set();return payload.elements.flatMap(e=>{if(!e || typeof e!=='object')return [];const p={lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon};if(!validPoint(p)||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.tags?.amenity!=='pharmacy')return [];const id=`${e.type}/${e.id}`;if(seen.has(id))return [];seen.add(id);const t=e.tags??{};return [{id,...p,name:typeof t.name==='string'?t.name:'',address:[t['addr:street'],t['addr:housenumber'],t['addr:city']].filter(x=>typeof x==='string').join(' '),hours:typeof t.opening_hours==='string'?t.opening_hours.trim().slice(0,240):'',distance:distance(origin,p)}];}).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));}
export async function search(origin, fetcher, signal){const center=approximate(origin);const offset=distance(origin,center);let results=[];for(const radius of radii){signal?.throwIfAborted();const payload=await fetcher(query(center,radius),signal);signal?.throwIfAborted();results=normalize(payload,origin);if(results.length&&results[0].distance+offset<radius)return {results,radius,covered:true};}return {results,radius:radii.at(-1),covered:false};}
export const mapsUrl=p=>`https://www.openstreetmap.org/?mlat=${encodeURIComponent(p.lat)}&mlon=${encodeURIComponent(p.lon)}#map=18/${encodeURIComponent(p.lat)}/${encodeURIComponent(p.lon)}`;

/** Only the selected pharmacy's coordinates are sent, not the search origin. */
export function embedUrl(p){
  if(!validPoint(p))throw new Error('invalid map point');
  const lonDelta=Math.min(0.08,0.008/Math.max(0.1,Math.cos(p.lat*Math.PI/180)));
  const box=[Math.max(-180,p.lon-lonDelta),Math.max(-85.05,Math.min(85.04,p.lat-0.008)),Math.min(180,p.lon+lonDelta),Math.max(-85.04,Math.min(85.05,p.lat+0.008))];
  const u=new URL('https://www.openstreetmap.org/export/embed.html');
  u.search=new URLSearchParams({bbox:box.join(','),layer:'mapnik',marker:[p.lat,p.lon].join(',')}).toString();
  return u.href;
}
