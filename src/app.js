import {mapsUrl, embedUrl} from './core.js';
import {strings, extra, ux} from './strings.js';
import {createSearchController} from './search-controller.js';
import {fetchPharmacies} from './provider.js';

const $ = id => document.getElementById(id);
let lang = 'en';
let expanded = false;
let selected = null;
const initialLimit = 5;
const tr = key => strings[lang][key] ?? extra[lang][key];
const controller = createSearchController({
  fetcher: fetchPharmacies,
  geolocation: navigator.geolocation,
  onChange(next) {
    state = next;
    if (next.busy) { expanded = false; closeMap(); }
    render();
  },
});
let state = controller.state;

function renderUX(){
 const {status,result:data}=state;
 const copy=ux[lang];for(const [id,key] of Object.entries({'privacy-summary':'privacySummary',retry:'retry','fallback-directory':'fallback','distance-note':'distanceNote','change-location':'changeLocation'}))$(id).textContent=copy[key];
 const failed=['error','denied','empty'].includes(status),found=status==='found';
 $('recovery').hidden=!failed;
 $('directory').parentElement.hidden=failed;$('retry').hidden=!state.canRetry||status==='denied'||status==='empty';
 $('distance-note').hidden=!found;$('result-tools').hidden=!found;
 $('show-all').hidden=!found||data.results.length<=initialLimit;
 $('show-all').textContent=expanded?copy.showLess:copy.showAll;
 $('show-all').setAttribute('aria-expanded',String(expanded));
 $('show-all').setAttribute('aria-controls','list');
 document.body.dataset.searchState=status;
}

function closeMap(restore=false){const id=selected?.id;selected=null;$('map-panel').hidden=true;$('map-frame').replaceChildren();if(restore&&id){[...document.querySelectorAll('[data-map-id]')].find(b=>b.dataset.mapId===id)?.focus();}}
function openMap(p){selected=p;const frame=document.createElement('iframe');frame.src=embedUrl(p);frame.title=tr('mapTitle')+' '+(p.name||tr('unnamed'));frame.referrerPolicy='no-referrer';$('map-frame').replaceChildren(frame);$('map-panel').hidden=false;updateMapLabels();$('map-heading').focus();}
function updateMapLabels(){ const {status}=state; $('close-map').textContent=tr('closeMap');$('map-privacy').textContent=tr('mapPrivacy');$('directory').textContent=tr('directory');$('map-disclosure').textContent=tr('mapPrivacy');$('map-disclosure').hidden=status!=='found';if(selected){const title=tr('mapTitle')+' '+(selected.name||tr('unnamed'));$('map-heading').textContent=title;const frame=$('map-frame').querySelector('iframe');if(frame)frame.title=title;}}
function render(){
  const {status,result:data,origin:originName}=state;
  const section=document.querySelector('.results');
  section.dataset.state=status;
  renderUX();
  updateMapLabels();
  $('loading-art').hidden=!['loading','locating'].includes(status);
  $('list').setAttribute('aria-busy',String(['loading','locating'].includes(status)));
document.documentElement.lang=lang;const labels={'language-label':'language',eyebrow:'eyebrow',heading:'heading',intro:'intro','locate-label':'locate',privacy:'privacy','city-label':'city','search-label':'search','results-heading':'results',cancel:'cancel',disclaimer:'disclaimer'};for(const [id,k] of Object.entries(labels))$(id).textContent=tr(k);document.querySelector('.skip').textContent=tr('skip');$('list').setAttribute('aria-label',tr('results'));$('cancel').hidden=!state.busy;const list=$('list');list.replaceChildren();$('status').textContent=status==='found'?`${tr('found')}: ${data.results.length} · ${originName==='device'?tr('device'):originName}. ${data.covered?'':tr('limited')} ${data.results.length>20?tr('shown'):''}`:tr(status);if(status!=='found')return;for(const [i,p] of data.results.slice(0,expanded?20:initialLimit).entries()){
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

$('locate').addEventListener('click', () => controller.locate());
$('city-form').addEventListener('submit', event => {
  event.preventDefault();
  controller.city($('city').value);
});
$('retry').addEventListener('click', () => controller.retry());
$('cancel').addEventListener('click', () => {
  controller.cancel();
  $('locate').focus();
});
$('close-map').addEventListener('click', () => closeMap(true));
$('show-all').addEventListener('click', () => {
  expanded = !expanded;
  closeMap();
  render();
  $('show-all').focus();
});
$('change-location').addEventListener('click', event => {
  event.preventDefault();
  $('locate').focus();
});
$('language').addEventListener('change', event => {
  lang = event.target.value;
  render();
});
const today = new Date();
const month = today.getMonth() + 1, day = today.getDate();
if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 6)) {
  document.body.dataset.season = 'christmas';
}
render();
