// Faithful replica of ingest/src/extract.ts htmlToText (for local inspection).
const fs = require("fs");
const DROP = ["script","style","head","noscript","template","nav","header","footer","aside"];
const BLOCK_CLOSE = /<\/(p|div|section|article|li|tr|h[1-6]|blockquote|td|th)>/gi;
function codePoint(n){return n>=0&&n<=0x10ffff?String.fromCodePoint(n):"�";}
function decodeEntities(s){
  return s.replace(/&nbsp;/gi," ")
    .replace(/&#(\d+);/g,(_,d)=>codePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>codePoint(parseInt(h,16)))
    .replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&quot;",'"').replaceAll("&amp;","&");
}
function collapse(s){
  return s.split("\n").map(l=>l.replace(/[^\S\n]+/g," ").trim()).filter(l=>l.length>0).join("\n");
}
function htmlToText(html){
  let s = html.replace(/<!--[\s\S]*?-->/g," ");
  for(const t of DROP) s=s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?</${t}>`,"gi")," ");
  s=s.replace(BLOCK_CLOSE,"\n").replace(/<br\s*\/?>/gi,"\n");
  s=s.replace(/<[^>]+>/g," ");
  return collapse(decodeEntities(s));
}
const f = process.argv[2];
const out = htmlToText(fs.readFileSync(f,"utf8"));
fs.writeFileSync(process.argv[3], out);
console.log(`${f} -> ${process.argv[3]}: ${out.length} chars, ${out.split("\n").length} lines`);
