import {cities,search,mapsUrl,embedUrl} from './core.js';
const strings={en:{language:'Language',skip:'Skip to content',eyebrow:'PHARMACY FINDER',heading:'Find a pharmacy near you.',intro:'Find the closest mapped pharmacies by straight-line distance. No account needed.',locate:'Use my location',privacy:'Only a location rounded to 2 decimal places is sent to OpenStreetMap’s Overpass service. Distances are calculated on your device.',city:'Or search from a city centre',search:'Search',results:'Nearby pharmacies',cancel:'Cancel',idle:'Choose your location to start.',locating:'Getting your location…',loading:'Searching for pharmacies…',error:'Search is temporarily unavailable. Try again or choose another city.',denied:'Location is unavailable or denied. Choose a city centre instead.',empty:'No mapped pharmacies found within the searched area.',found:'Mapped pharmacies found',limited:'Search coverage is limited.',nearest:'Closest mapped result',unnamed:'Unnamed pharmacy',map:'View on map',disclaimer:'Distances are not walking routes. Check pharmacy opening hours before travelling. Map data can be incomplete.',device:'your location',cancelled:'Search cancelled.'},fi:{language:'Kieli',skip:'Siirry sisältöön',eyebrow:'APTEEKKIHAKU',heading:'Löydä apteekki läheltäsi.',intro:'Löydä lähimmät kartalla olevat apteekit linnuntie-etäisyyden mukaan. Et tarvitse tiliä.',locate:'Käytä sijaintiani',privacy:'OpenStreetMapin Overpass-palveluun lähetetään vain kahden desimaalin tarkkuuteen pyöristetty sijainti. Etäisyydet lasketaan laitteellasi.',city:'Tai hae kaupungin keskustasta',search:'Hae',results:'Lähellä olevat apteekit',cancel:'Peruuta',idle:'Valitse sijainti aloittaaksesi.',locating:'Haetaan sijaintia…',loading:'Haetaan apteekkeja…',error:'Haku ei ole juuri nyt käytettävissä. Yritä uudelleen tai valitse toinen kaupunki.',denied:'Sijaintia ei saatu. Valitse kaupungin keskusta.',empty:'Hakualueelta ei löytynyt kartalla olevia apteekkeja.',found:'Kartalta löytyneet apteekit',limited:'Haun kattavuus on rajallinen.',nearest:'Lähin karttatulos',unnamed:'Nimetön apteekki',map:'Näytä kartalla',disclaimer:'Etäisyydet eivät ole kävelyreittejä. Tarkista aukioloajat ennen lähtöä. Karttatiedot voivat olla puutteellisia.',device:'oma sijainti',cancelled:'Haku peruttu.'},sv:{language:'Språk',skip:'Hoppa till innehållet',eyebrow:'APOTEKSSÖKNING',heading:'Hitta ett apotek nära dig.',intro:'Hitta närmaste kartlagda apotek enligt fågelvägsavstånd. Inget konto behövs.',locate:'Använd min plats',privacy:'Endast en position avrundad till två decimaler skickas till OpenStreetMaps Overpass-tjänst. Avstånd beräknas på din enhet.',city:'Eller sök från ett stadscentrum',search:'Sök',results:'Apotek i närheten',cancel:'Avbryt',idle:'Välj en plats för att börja.',locating:'Hämtar din plats…',loading:'Söker apotek…',error:'Sökningen är tillfälligt otillgänglig. Försök igen eller välj en annan stad.',denied:'Platsen är otillgänglig. Välj ett stadscentrum.',empty:'Inga kartlagda apotek hittades i sökområdet.',found:'Kartlagda apotek hittades',limited:'Sökningens täckning är begränsad.',nearest:'Närmaste kartresultat',unnamed:'Namnlöst apotek',map:'Visa på karta',disclaimer:'Avstånden är inte promenadrutter. Kontrollera öppettiderna innan du åker. Kartdata kan vara ofullständiga.',device:'din plats',cancelled:'Sökningen avbröts.'}};
const extra={
 en:{hours:'Mapped hours (unverified)',missingHours:'Hours not listed',mapHere:'Map preview',closeMap:'Close map',mapPrivacy:'OpenStreetMap loads this pharmacy location and receives your IP address.',directory:'Check Finnish pharmacy details at Apteekki.fi',mapTitle:'Map of',shown:'Showing up to 20'},
 fi:{hours:'Karttaan merkityt aukioloajat (vahvistamatta)',missingHours:'Aukioloaikoja ei ilmoitettu',mapHere:'Karttanäkymä',closeMap:'Sulje kartta',mapPrivacy:'OpenStreetMap lataa apteekin sijainnin ja saa IP-osoitteesi.',directory:'Tarkista apteekin tiedot Apteekki.fi-palvelusta',mapTitle:'Kartta:',shown:'Näytetään enintään 20'},
 sv:{hours:'Kartlagda öppettider (ej bekräftade)',missingHours:'Öppettider saknas',mapHere:'Kartvy',closeMap:'Stäng kartan',mapPrivacy:'OpenStreetMap laddar apotekets plats och får din IP-adress.',directory:'Kontrollera apoteksuppgifter på Apteekki.fi',mapTitle:'Karta över',shown:'Visar högst 20'}
};
const $=id=>document.getElementById(id);let lang='en',status='idle',data=null,originName='',current=null,generation=0;const tr=k=>strings[lang][k]??extra[lang][k];
const ux={
 en:{privacySummary:'Location privacy',retry:'Try again',fallback:'Find a pharmacy on Apteekki.fi',distanceNote:'Distances are straight-line estimates, not walking routes.',showAll:'Show more pharmacies',showLess:'Show fewer pharmacies',changeLocation:'Change location'},
 fi:{privacySummary:'Sijainnin yksityisyys',retry:'Yritä uudelleen',fallback:'Etsi apteekki Apteekki.fi-palvelusta',distanceNote:'Etäisyydet ovat linnuntiearvioita, eivät kävelyreittejä.',showAll:'Näytä lisää apteekkeja',showLess:'Näytä vähemmän apteekkeja',changeLocation:'Vaihda sijaintia'},
 sv:{privacySummary:'Platsintegritet',retry:'Försök igen',fallback:'Hitta apotek på Apteekki.fi',distanceNote:'Avstånden är uppskattade fågelvägsavstånd, inte gångvägar.',showAll:'Visa fler apotek',showLess:'Visa färre apotek',changeLocation:'Byt plats'}
};
let selected=null,lastAction=null,expanded=false;
const initialLimit=5;
function startCity(){const city=$('city').value;lastAction=()=>run(cities[city],city,begin('loading'));lastAction();}
function startLocation(){lastAction=startLocation;const job=begin('locating');if(!navigator.geolocation){finish(job.id,'denied');return;}navigator.geolocation.getCurrentPosition(p=>run({lat:p.coords.latitude,lon:p.coords.longitude},'device',job),()=>finish(job.id,'denied'),{enableHighAccuracy:false,timeout:12000,maximumAge:0});}
function renderUX(){
 const copy=ux[lang];for(const [id,key] of Object.entries({'privacy-summary':'privacySummary',retry:'retry','fallback-directory':'fallback','distance-note':'distanceNote','change-location':'changeLocation'}))$(id).textContent=copy[key];
 const failed=['error','denied','empty'].includes(status),found=status==='found';
 $('recovery').hidden=!failed;
 $('directory').parentElement.hidden=failed;$('retry').hidden=!lastAction||status==='denied'||status==='empty';
 $('distance-note').hidden=!found;$('result-tools').hidden=!found;
 $('show-all').hidden=!found||data.results.length<=initialLimit;
 $('show-all').textContent=expanded?copy.showLess:copy.showAll;
 $('show-all').setAttribute('aria-expanded',String(expanded));
 $('show-all').setAttribute('aria-controls','list');
 document.body.dataset.searchState=status;
}

function closeMap(restore=false){const id=selected?.id;selected=null;$('map-panel').hidden=true;$('map-frame').replaceChildren();if(restore&&id){[...document.querySelectorAll('[data-map-id]')].find(b=>b.dataset.mapId===id)?.focus();}}
function openMap(p){selected=p;const frame=document.createElement('iframe');frame.src=embedUrl(p);frame.title=tr('mapTitle')+' '+(p.name||tr('unnamed'));frame.referrerPolicy='no-referrer';$('map-frame').replaceChildren(frame);$('map-panel').hidden=false;updateMapLabels();$('map-heading').focus();}
function updateMapLabels(){ $('close-map').textContent=tr('closeMap');$('map-privacy').textContent=tr('mapPrivacy');$('directory').textContent=tr('directory');$('map-disclosure').textContent=tr('mapPrivacy');$('map-disclosure').hidden=status!=='found';if(selected){const title=tr('mapTitle')+' '+(selected.name||tr('unnamed'));$('map-heading').textContent=title;const frame=$('map-frame').querySelector('iframe');if(frame)frame.title=title;}}
function render(){
  const section=document.querySelector('.results');
  section.dataset.state=status;
  renderUX();
  updateMapLabels();
  $('loading-art').hidden=!['loading','locating'].includes(status);
  $('list').setAttribute('aria-busy',String(['loading','locating'].includes(status)));
document.documentElement.lang=lang;const labels={'language-label':'language',eyebrow:'eyebrow',heading:'heading',intro:'intro','locate-label':'locate',privacy:'privacy','city-label':'city','search-label':'search','results-heading':'results',cancel:'cancel',disclaimer:'disclaimer'};for(const [id,k] of Object.entries(labels))$(id).textContent=tr(k);document.querySelector('.skip').textContent=tr('skip');$('list').setAttribute('aria-label',tr('results'));$('cancel').hidden=!current;const list=$('list');list.replaceChildren();$('status').textContent=status==='found'?`${tr('found')}: ${data.results.length} · ${originName==='device'?tr('device'):originName}. ${data.covered?'':tr('limited')} ${data.results.length>20?tr('shown'):''}`:tr(status);if(status!=='found')return;for(const [i,p] of data.results.slice(0,expanded?20:initialLimit).entries()){
    const li=document.createElement('li'), rank=document.createElement('span'), left=document.createElement('div'), h=document.createElement('h3'), dist=document.createElement('span'), address=document.createElement('p'), link=document.createElement('a');
    li.className=i===0?'pharmacy closest':'pharmacy';
    rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');rank.setAttribute('aria-hidden','true');
    left.className='pharmacy-info';
    if(i===0){const note=document.createElement('p');note.className='closest-label';note.textContent=tr('nearest');left.append(note);}
    h.textContent=p.name||tr('unnamed');left.append(h);
    if(p.address){address.textContent=p.address;left.append(address);}
    const hours=document.createElement('p');hours.className='hours';hours.textContent=p.hours?tr('hours')+': '+p.hours:tr('missingHours');left.append(hours);
    dist.className='distance';dist.textContent=new Intl.NumberFormat(lang,{style:'unit',unit:p.distance<1000?'meter':'kilometer',maximumFractionDigits:p.distance<1000?0:1}).format(p.distance<1000?p.distance:p.distance/1000);
    link.href=mapsUrl(p);link.rel='noreferrer';link.textContent=tr('map');link.setAttribute('aria-label',`${tr('map')}: ${h.textContent}`);
    const action=document.createElement('div');action.className='pharmacy-action';const preview=document.createElement('button');preview.type='button';preview.className='map-preview';preview.textContent=tr('mapHere');preview.dataset.mapId=p.id;preview.setAttribute('aria-label',tr('mapHere')+': '+h.textContent);preview.setAttribute('aria-describedby','map-disclosure');preview.addEventListener('click',()=>openMap(p));action.append(dist,preview,link);
    li.append(rank,left,action);list.append(li);
  }
}
function begin(next){expanded=false;closeMap();current?.abort();current=new AbortController();generation++;data=null;status=next;render();return {controller:current,id:generation};}
function finish(id,next,result=null){if(id!==generation)return;current=null;status=next;data=result;render();}
async function fetcher(query,signal){const controller=new AbortController();const relay=()=>controller.abort();signal.addEventListener("abort",relay,{once:true});if(signal.aborted)relay();const timer=setTimeout(relay,20000);try{const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('network');return await response.json();}finally{clearTimeout(timer);signal.removeEventListener("abort",relay);}}
async function run(point,name,job){if(job.id!==generation)return;originName=name;status='loading';render();try{const result=await search(point,fetcher,job.controller.signal);finish(job.id,result.results.length?'found':'empty',result);}catch{finish(job.id,'error');}}
$('locate').addEventListener('click',startLocation);
$('city-form').addEventListener('submit',e=>{e.preventDefault();startCity();});
$('retry').addEventListener('click',()=>lastAction?.());
$('cancel').addEventListener('click',()=>{current?.abort();generation++;current=null;data=null;status='cancelled';render();$('locate').focus();});
$('close-map').addEventListener('click',()=>closeMap(true));
$('show-all').addEventListener('click',()=>{expanded=!expanded;closeMap();render();$('show-all').focus();});
$('change-location').addEventListener('click',e=>{e.preventDefault();$('locate').focus();});
$('language').addEventListener('change',e=>{lang=e.target.value;render();});
render();
