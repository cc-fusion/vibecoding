var u={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var n=([e,a,o])=>{let r=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(a).forEach(t=>{r.setAttribute(t,String(a[t]))}),o?.length&&o.forEach(t=>{let s=n(t);r.appendChild(s)}),r},c=(e,a={})=>{let r={...u,...a};return n(["svg",r,e])};var C=(...e)=>e.filter((a,o,r)=>!!a&&a.trim()!==""&&r.indexOf(a)===o).join(" ").trim();var h=e=>{for(let a in e)if(a.startsWith("aria-")||a==="role"||a==="title")return!0;return!1};var S=e=>{let a="",o=!1;for(let r of e){if(r==="-"||r==="_"||r<=" "){o=a.length>0;continue}a.length===0?a+=r.toLowerCase():a+=o?r.toUpperCase():r,o=!1}return a};var g=e=>{let a=S(e);return a.charAt(0).toUpperCase()+a.slice(1)};var U=e=>Array.from(e.attributes).reduce((a,o)=>(a[o.name]=o.value,a),{}),k=e=>typeof e=="string"?e:!e||!e.class?"":e.class&&typeof e.class=="string"?e.class.split(" "):e.class&&Array.isArray(e.class)?e.class:"",d=(e,{nameAttr:a,icons:o,attrs:r})=>{let t=e.getAttribute(a);if(t==null)return;let s=g(t),f=o[s];if(!f)return console.warn(`${e.outerHTML} icon name was not found in the provided icons object.`);let l=U(e),y=h(l)?{}:{"aria-hidden":"true"},x={...u,"data-lucide":t,...y,...r,...l},T=k(l),q=k(r),i=C("lucide",`lucide-${t}`,...T,...q);i&&Object.assign(x,{class:i});let b=c(f,x);return e.parentNode?.replaceChild(b,e)};var p=[["path",{d:"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"}],["path",{d:"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"}]];var w=[["path",{d:"M20 6 9 17l-5-5"}]];var P=[["path",{d:"m6 9 6 6 6-6"}]];var A=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"}]];var B=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{d:"M3 3v5h5"}]];var M=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{cx:"12",cy:"12",r:"3"}]];var D=[["circle",{cx:"12",cy:"12",r:"4"}],["path",{d:"M12 2v2"}],["path",{d:"M12 20v2"}],["path",{d:"m4.93 4.93 1.41 1.41"}],["path",{d:"m17.66 17.66 1.41 1.41"}],["path",{d:"M2 12h2"}],["path",{d:"M20 12h2"}],["path",{d:"m6.34 17.66-1.41 1.41"}],["path",{d:"m19.07 4.93-1.41 1.41"}]];var L=[["path",{d:"M12 19h8"}],["path",{d:"m4 17 6-6-6-6"}]];var m=[["path",{d:"M10 11v6"}],["path",{d:"M14 11v6"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{d:"M3 6h18"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]];var F=[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]];var R=({icons:e={},nameAttr:a="data-lucide",attrs:o={},root:r=document,inTemplates:t}={})=>{if(!Object.values(e).length)throw new Error(`Please provide an icons object.
If you want to use all the icons you can import it like:
 \`import { createIcons, icons } from 'lucide';
lucide.createIcons({icons});\``);if(typeof r>"u")throw new Error("`createIcons()` only works in a browser environment.");if(Array.from(r.querySelectorAll(`[${a}]`)).forEach(f=>d(f,{nameAttr:a,icons:e,attrs:o})),t&&Array.from(r.querySelectorAll("template")).forEach(l=>R({icons:e,nameAttr:a,attrs:o,root:l.content,inTemplates:t})),a==="data-lucide"){let f=r.querySelectorAll("[icon-name]");f.length>0&&(console.warn("[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"),Array.from(f).forEach(l=>d(l,{nameAttr:"icon-name",icons:e,attrs:o})))}};export{p as Braces,w as Check,P as ChevronDown,A as Moon,B as RotateCcw,M as Settings,D as Sun,L as Terminal,m as Trash2,F as X,R as createIcons};
/*! Bundled license information:

lucide/dist/esm/defaultAttributes.mjs:
lucide/dist/esm/createElement.mjs:
lucide/dist/esm/shared/src/utils/mergeClasses.mjs:
lucide/dist/esm/shared/src/utils/hasA11yProp.mjs:
lucide/dist/esm/shared/src/utils/toCamelCase.mjs:
lucide/dist/esm/shared/src/utils/toPascalCase.mjs:
lucide/dist/esm/replaceElement.mjs:
lucide/dist/esm/icons/braces.mjs:
lucide/dist/esm/icons/check.mjs:
lucide/dist/esm/icons/chevron-down.mjs:
lucide/dist/esm/icons/moon.mjs:
lucide/dist/esm/icons/rotate-ccw.mjs:
lucide/dist/esm/icons/settings.mjs:
lucide/dist/esm/icons/sun.mjs:
lucide/dist/esm/icons/terminal.mjs:
lucide/dist/esm/icons/trash.mjs:
lucide/dist/esm/icons/x.mjs:
lucide/dist/esm/lucide.mjs:
  (**
   * @license lucide v1.63.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
