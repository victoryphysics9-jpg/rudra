// Supabase Edge Function. Set ALLOWED_ORIGINS, TURNSTILE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Deno.serve(async (req: Request) => {
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim());
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization','Vary':'Origin'};
 const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!allowed.includes(origin)||!origin)return response(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'Method not allowed'});
 try {
  const text=await req.text();if(text.length>16000)return response(413,{error:'Request too large'});
  const p=JSON.parse(text);const clean=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
  const name=clean(p.name,100),phone=clean(p.phone,30),message=clean(p.message,2000),email=clean(p.email,150);
  if(!name||!message||!/^\+?[\d\s()-]{7,30}$/.test(phone)||p.consent!==true||p.website||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return response(400,{error:'Invalid enquiry'});
  const secret=Deno.env.get('TURNSTILE_SECRET_KEY');if(!secret)return response(503,{error:'Captcha not configured'});
  const captcha=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:clean(p.captcha,2048)})});
  const verdict=await captcha.json();if(!verdict.success)return response(400,{error:'Captcha verification failed'});
  const items=Array.isArray(p.items)?p.items.slice(0,50).map((i:any)=>({slug:clean(i.slug,100),name:clean(i.name,150),qty:Math.max(1,Math.min(99999,Math.round(Number(i.qty)||1)))})).filter((i:any)=>i.slug):[];
  const attribution:Record<string,string>={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid']){const v=clean(p.attribution?.[k],200);if(v)attribution[k]=v;}
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');if(!key||!url)return response(503,{error:'Backend not configured'});
  const db=await fetch(url+'/rest/v1/enquiries?select=id',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({name,phone,email,message,company:clean(p.company,150),location:clean(p.location,150),product:clean(p.product,100),items,attribution})});
  if(!db.ok)return response(502,{error:'Unable to store enquiry'});const rows=await db.json();return response(201,{id:rows[0].id});
 }catch{return response(400,{error:'Unable to process request'});}
});
