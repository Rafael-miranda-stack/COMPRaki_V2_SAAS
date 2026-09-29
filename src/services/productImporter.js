const cheerio=require("cheerio");

function num(v){
  if(v==null||v==="")return null;
  let s=String(v).trim().replace(/[^\d,.-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf(".")) s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else if(s.includes(",")) s=s.replace(",",".");
  const n=Number(s); return Number.isFinite(n)?n:null;
}
function abs(base,v){try{return v?new URL(v,base).href:null}catch{return v||null}}
function types(v){return Array.isArray(v)?v:[v]}
function walkJson(node,cb){
  if(!node)return;
  if(Array.isArray(node))return node.forEach(x=>walkJson(x,cb));
  if(typeof node==="object"){
    cb(node);
    if(node["@graph"])walkJson(node["@graph"],cb);
    for(const [k,v] of Object.entries(node)) if(k!=="@graph" && typeof v==="object") walkJson(v,cb);
  }
}
function offerPrice(o){
  if(!o)return null;
  if(Array.isArray(o))for(const x of o){const p=offerPrice(x);if(p)return p}
  return num(o.price)||num(o.lowPrice)||num(o.highPrice)||num(o.priceSpecification?.price);
}
async function importProduct(url){
  const u=new URL(url), controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
  const headers={
    "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language":"pt-BR,pt;q=0.9,en;q=0.7",
    "cache-control":"no-cache"
  };
  try{
    const r=await fetch(url,{signal:controller.signal,headers,redirect:"follow"});
    if(!r.ok)throw Error("HTTP "+r.status);
    const html=await r.text(), $=cheerio.load(html);
    const p={url,store:u.hostname.replace(/^www\./,""),name:null,description:null,image:null,price:null,brand:null,partial:false};

    $('script[type="application/ld+json"]').each((_,el)=>{
      try{
        const raw=$(el).contents().text().trim(); if(!raw)return;
        const parsed=JSON.parse(raw);
        walkJson(parsed,obj=>{
          const t=types(obj["@type"]).map(String);
          if(t.includes("Product")){
            p.name=p.name||obj.name||obj.headline;
            p.description=p.description||obj.description;
            const im=Array.isArray(obj.image)?obj.image[0]:(obj.image?.url||obj.image);
            p.image=p.image||abs(url,im);
            p.brand=p.brand||(typeof obj.brand==="string"?obj.brand:obj.brand?.name);
            p.price=p.price||offerPrice(obj.offers);
          }
          if(t.includes("Offer")||t.includes("AggregateOffer"))p.price=p.price||offerPrice(obj);
        });
      }catch{}
    });

    const meta=(...sels)=>{for(const s of sels){const v=$(s).attr("content");if(v)return v.trim()}return null};
    p.name=p.name||meta('meta[property="og:title"]','meta[name="twitter:title"]','meta[itemprop="name"]')||$("h1").first().text().trim()||$("title").text().trim();
    p.description=p.description||meta('meta[property="og:description"]','meta[name="description"]','meta[name="twitter:description"]');
    p.image=p.image||abs(url,meta('meta[property="og:image"]','meta[name="twitter:image"]','meta[itemprop="image"]'));
    p.price=p.price||
      num(meta('meta[property="product:price:amount"]','meta[itemprop="price"]','meta[property="og:price:amount"]'))||
      num($('[itemprop="price"]').first().attr("content"))||
      num($('[data-price]').first().attr("data-price"));

    // Amazon: o preço costuma vir separado em parte inteira + centavos.
    if(/(^|\.)amazon\.com\.br$/i.test(u.hostname) || /(^|\.)amazon\./i.test(u.hostname)){
      p.name=p.name||$('#productTitle').first().text().trim()||$('#title').first().text().trim();
      p.description=p.description||$('#feature-bullets').text().replace(/\s+/g,' ').trim()||null;
      p.image=p.image||abs(url,$('#landingImage').attr('src')||$('#imgBlkFront').attr('src'));

      const amazonPriceSelectors=[
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '#price_inside_buybox',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.priceToPay .a-offscreen',
        '.reinventPricePriceToPayMargin .a-offscreen',
        '.a-price .a-offscreen'
      ];
      for(const sel of amazonPriceSelectors){
        const value=$(sel).first().text().trim()||$(sel).first().attr('content');
        const parsed=num(value);
        if(parsed && parsed>0){p.price=parsed;break}
      }
      if(!p.price){
        const whole=$('.a-price-whole').first().text().replace(/[^\d]/g,'');
        const fraction=$('.a-price-fraction').first().text().replace(/[^\d]/g,'');
        if(whole){
          const parsed=Number(whole)+(fraction?Number(fraction)/Math.pow(10,fraction.length):0);
          if(Number.isFinite(parsed)&&parsed>0)p.price=parsed;
        }
      }
    }

    // Heurística de fallback para HTML comum
    if(!p.price){
      const candidates=[];
      $('[class*="price"],[id*="price"],[class*="preco"],[id*="preco"]').slice(0,40).each((_,el)=>{
        const n=num($(el).text()); if(n && n>0 && n<10000000)candidates.push(n);
      });
      if(candidates.length)p.price=candidates[0];
    }

    if(!p.name){
      const slug=u.pathname.split("/").filter(Boolean).pop()||"";
      p.name=decodeURIComponent(slug).replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()).slice(0,220);
      p.partial=true;
    }
    if(!p.price)p.partial=true;
    return p;
  }finally{clearTimeout(timer)}
}
module.exports={importProduct};
