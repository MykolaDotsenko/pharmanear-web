import {cp,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
for(const file of ['index.html','favicon.svg','src'])await cp(new URL(file,root),new URL(file,dist),{recursive:true});
