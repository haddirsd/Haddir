const base = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !anon || !service) throw new Error('Missing disposable project credentials');
async function call(path, method='DELETE', body) {
  const headers = { apikey: anon, Authorization: 'Bearer ' + service };
  let payload;
  if (body !== undefined) { headers['Content-Type']='application/json'; payload=JSON.stringify(body); }
  const r=await fetch(base+path,{method,headers,body:payload});
  const raw=await r.text();
  if(!r.ok) throw new Error(method+' '+path+' failed HTTP '+r.status+': '+raw.slice(0,400));
  return raw;
}
(async()=>{
  const uid='df27c6da-7dda-4932-80e5-b975ea4ed2b5';
  const booking='9aa751db-d96a-4f50-a7b3-6c621128b943';
  const event='4e946aaa-629c-44e8-bf90-46b5c8c2f52c';
  await call('/storage/v1/object/payment-receipts','DELETE',{prefixes:[uid+'/'+booking+'/receipt.png']});
  await call('/rest/v1/payment_submissions?booking_id=eq.'+booking);
  await call('/rest/v1/bookings?id=eq.'+booking);
  await call('/rest/v1/events?id=eq.'+event);
  await call('/auth/v1/admin/users/'+uid);
  console.log('PASS: failed-attempt disposable user, receipt, booking, payment and event cleaned');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
