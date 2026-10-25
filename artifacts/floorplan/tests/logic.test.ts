import { parseImport, ImportError, parseStored } from "../src/lib/schema";
import { alignMoves, distributeMoves, snapBox, furnitureBox } from "../src/lib/layout";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const err = (txt: string) => { try { parseImport(txt); return null; } catch (e) { return e as ImportError; } };

// --- import validation
ok(err("{not json") instanceof ImportError, "JSON roto rechazado");
ok(err("[]") !== null, "array en raíz rechazado");
ok(err("{}") !== null, "objeto vacío (no es plano) rechazado");
ok(err('{"walls":"x"}') !== null, "walls no-lista rechazado");
ok(err('{"walls":[{"x1":"a","y1":0,"x2":1,"y2":1}]}') !== null, "coordenada no numérica rechazada");
ok(err('{"walls":[{"x1":1e99,"y1":0,"x2":1,"y2":1}]}') !== null, "coordenada absurda rechazada");
ok(err('{"furniture":[{"kind":"bed","x":0,"y":0,"w":-5,"h":10}]}') !== null, "ancho negativo rechazado");
ok(err('{"walls":[{"id":"__proto__","x1":0,"y1":0,"x2":9,"y2":9}]}') !== null, "id __proto__ rechazado");
const e1 = err('{"furniture":[{"kind":"bed","x":0,"y":0,"w":-5,"h":10}]}')!;
console.log("   mensaje:", e1.message, "|", e1.details);
const good = parseImport(JSON.stringify({
  walls:[{x1:0,y1:0,x2:100,y2:0,color:"rojo",effect:"zzz"}],
  furniture:[{kind:"bed",x:1,y:2,w:10,h:10,rotation:90}],
  texts:[{text:"hola",x:0,y:0}], rooms:[{id:"r"}], extra:1 }));
ok(good.walls![0].color === undefined && good.walls![0].effect === undefined, "estilo inválido se descarta sin fallar");
ok(!("rooms" in good), "claves desconocidas (rooms) se ignoran");

// --- stored
ok(!parseStored("hola").ok, "stored: no-objeto rechazado");
ok(!parseStored({doc:{nodes:{a:{id:"a",x:"q",y:0}}}}).ok, "stored: nodo corrupto rechazado");
const r = parseStored({doc:{nodes:{a:{id:"a",x:0,y:0}},walls:{w:{id:"w",a:"a",b:"zz",thickness:10}},doors:{d:{id:"d",wallId:"w",offset:5,width:90}}},settings:{unit:"bad",gridSnap:true}});
ok(r.ok && Object.keys(r.doc.walls).length===0 && Object.keys(r.doc.doors).length===0, "stored: pared con nodo inexistente y su puerta se eliminan");
ok(r.ok && r.settings.unit==="cm" && r.settings.gridSnap===true && r.settings.smartGuides===true, "stored: settings con defaults");
ok(parseStored({}).ok, "stored: estado vacío válido");

// --- layout
const P = (id:string,x:number,y:number,w:number,h:number) => ({type:"furniture" as const,id,box:furnitureBox({x,y,w,h,rotation:0})});
const items=[P("a",0,0,20,20),P("b",100,50,40,40),P("c",300,10,20,20)];
const left = alignMoves(items,"left");
ok(left.find(m=>m.id==="b")!.dx === -90 && left.find(m=>m.id==="c")!.dx===-300 && !left.find(m=>m.id==="a"), "alinear izquierda");
const top = alignMoves(items,"top");
ok(top.find(m=>m.id==="b")!.dy === -10-30 && top.find(m=>m.id==="c")!.dy === -10-0, "alinear arriba");
const dist = distributeMoves(items,"x");
// sorted a(-10..10) b(80..120) c(290..310): span 320, total 20+40+20=80, gap=120
ok(Math.abs(dist.find(m=>m.id==="b")!.dx - ((-10+20+120)-80)) < 1e-9, "distribuir horizontal: hueco igual");
ok(distributeMoves(items.slice(0,2),"x").length===0, "distribuir exige >=3");
const rot = furnitureBox({x:0,y:0,w:100,h:20,rotation:90});
ok(Math.abs(rot.maxx-10)<1e-9 && Math.abs(rot.maxy-50)<1e-9, "caja de mueble rotado 90°");

const s = snapBox({minx:103,maxx:123,miny:0,maxy:20},[{minx:0,maxx:20,miny:0,maxy:20},{minx:100,maxx:140,miny:100,maxy:140}],[],5);
ok(Math.abs(s.dx-(-3))<1e-9 && s.dy===0 && s.guides.some(g=>g.axis==="x"&&g.pos===100), "guía: se ajusta a borde (dx=-3) y genera línea");
const s2 = snapBox({minx:300,maxx:320,miny:0,maxy:20},[{minx:0,maxx:20,miny:0,maxy:20}],[],5);
ok(s2.dx===0 && s2.guides.some(g=>g.axis==="y"), "guía: alineado en Y sin tocar X lejos");
const s3 = snapBox({minx:50,maxx:70,miny:50,maxy:70},[{minx:0,maxx:20,miny:0,maxy:20}],[],5);
ok(s3.dx===0&&s3.dy===0&&s3.guides.length===0, "sin objetivos cerca: nada");

// --- persistence with a fake localStorage
import { saveState, loadState } from "../src/lib/persistence";
import { emptyDoc, defaultSettings } from "../src/types";
const store: Record<string,string> = {};
let mode: "ok"|"quota"|"security" = "ok";
(globalThis as any).DOMException = DOMException;
(globalThis as any).localStorage = {
  getItem: (k:string)=> store[k] ?? null,
  setItem: (k:string,v:string)=>{ if(mode==="quota") throw new DOMException("full","QuotaExceededError"); if(mode==="security") throw new DOMException("no","SecurityError"); store[k]=v; },
};
ok(saveState(emptyDoc(), defaultSettings()).ok, "guardar: ok");
mode="quota"; let q = saveState(emptyDoc(), defaultSettings());
ok(!q.ok && q.reason==="quota" && /lleno/.test((q as any).message), "guardar: cuota llena detectada y explicada");
mode="security"; q = saveState(emptyDoc(), defaultSettings());
ok(!q.ok && q.reason==="unavailable", "guardar: almacenamiento bloqueado detectado");
mode="ok"; store["floorplan:v1"]="{{{corrupto";
const l = loadState();
ok(!!l.warning && store["floorplan:v1:backup"]==="{{{corrupto" && Object.keys(l.doc.walls).length===0, "cargar: datos corruptos -> aviso + copia de seguridad + plano vacío");

// --- SEO: index.html, JSON-LD, imagen OG, robots
import { readFileSync } from "node:fs";
import { buildJsonLd, PAGES, AUTHOR, SITE, canonicalFor } from "../src/lib/site";
const root = process.cwd();
const html = readFileSync(`${root}/index.html`, "utf8");
const meta = (attr: string, key: string) =>
  new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html)?.[1];

const ldText = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
let ldOk = false;
try { ldOk = JSON.stringify(JSON.parse(ldText)) === JSON.stringify(JSON.parse(JSON.stringify(buildJsonLd("home")).replace(/</g, "\\u003c"))); } catch { /* handled below */ }
ok(ldOk, "SEO: JSON-LD de index.html == buildJsonLd('home') (sin desincronizar)");
const ldAll = JSON.stringify(buildJsonLd("home"));
ok([SITE.url, AUTHOR.blog, AUTHOR.hub, AUTHOR.contact, AUTHOR.name].every((u) => ldAll.includes(u)), "SEO: JSON-LD referencia app, blog, hub, contacto y autor");
ok(meta("name", "google-site-verification") === "fK2gZcSYwHHPqDFWdIB5WD1eVONqa6kwIFqkRDRyX4g", "SEO: google-site-verification");
ok(/<script src="https:\/\/aitors-hub-dashboard\.asanchezgu\.workers\.dev\/tracker\.js"\s+data-app="home-design-2d"\s+data-key="ak_68e6df9fc3254b05b79937b318f16caf"\s+async>/.test(html), "SEO: script de seguimiento del dashboard");
ok(new RegExp(`<link rel="canonical" href="${canonicalFor("home")}"`).test(html), "SEO: canonical de la home");
ok(meta("property", "og:image") === `${SITE.url}/og-image.png` && meta("name", "twitter:image") === `${SITE.url}/og-image.png`, "SEO: og:image y twitter:image apuntan a og-image.png");
ok(meta("property", "og:image:width") === "1200" && meta("property", "og:image:height") === "630", "SEO: og:image 1200x630");
ok(meta("name", "twitter:card") === "summary_large_image", "SEO: twitter:card summary_large_image");
ok(meta("property", "og:title") === PAGES.home.title && meta("name", "description") === PAGES.home.description, "SEO: index.html usa título y descripción de site.ts");
for (const k of ["home", "about"] as const) {
  ok(PAGES[k].title.length <= 60, `SEO: título ${k} <= 60 caracteres (${PAGES[k].title.length})`);
  ok(PAGES[k].description.length <= 160, `SEO: descripción ${k} <= 160 caracteres (${PAGES[k].description.length})`);
}
const png = readFileSync(`${root}/public/og-image.png`);
ok(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, "SEO: public/og-image.png mide 1200x630");
ok(/Sitemap: https:\/\/home-design-2d\.pages\.dev\/sitemap\.xml/.test(readFileSync(`${root}/public/robots.txt`, "utf8")), "SEO: robots.txt declara el sitemap");
const footer = readFileSync(`${root}/src/components/PageFooter.tsx`, "utf8");
ok(["AUTHOR.blog", "AUTHOR.hub", "AUTHOR.contact", "/acerca-de", "(c) 2026 Todos los derechos reservados"].every((t) => footer.includes(t)), "SEO: el footer enlaza blog, hub, contacto, acerca de y copyright");
console.log(fail? `\n${fail} FALLOS`:"\nTODO OK (final)"); process.exit(fail?1:0);
