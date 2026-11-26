import {cp,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const file of ['index.html','favicon.svg','src'])await cp(new URL(file,root),new URL(file,dist),{recursive:true});

// The catalog is optional until a verified extract is available. Never create placeholder data.
try { await cp(new URL('data/',root),new URL('data/',dist),{recursive:true}); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
