import { get } from '@vercel/blob';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const {pin,pathname}=req.body||{};
  const primaryPin=String(process.env.HOMIE_FAMILY_PIN||'').trim();
  const sisterPin=String(process.env.HOMIE_SISTER_PIN||'').trim();
  const enteredPin=String(pin||'').trim();
  const familyId=primaryPin&&enteredPin===primaryPin?'primary':(sisterPin&&sisterPin!==primaryPin&&enteredPin===sisterPin?'sister':null);
  if(!familyId)return res.status(401).json({error:'Unauthorized'});

  const path=String(pathname||'').trim();
  const isPreview=process.env.VERCEL_ENV==='preview';
  const familyPath=familyId==='primary'?'completions/':'sister/completions/';
  const currentPrefix=`homie/${isPreview?'preview/':''}${familyPath}`;
  // Read-only compatibility with photos saved before Preview photo isolation.
  // Legacy paths remain available to the same family PIN, but Preview never uploads there.
  const legacyPrefix=`homie/${familyPath}`;
  const permittedPrefixes=isPreview?[currentPrefix,legacyPrefix]:[currentPrefix];
  if(!permittedPrefixes.some(prefix=>path.startsWith(prefix)))
    return res.status(400).json({error:'Invalid photo path'});

  try{
    const result=await get(path,{
      access:'private',
      token:process.env.BLOB_READ_WRITE_TOKEN,
      useCache:false
    });
    if(!result||!result.stream)return res.status(404).json({error:'Photo not found'});

    res.statusCode=200;
    res.setHeader('Content-Type',result.blob?.contentType||'image/jpeg');
    res.setHeader('Cache-Control','private, no-store');
    const reader=result.stream.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value)res.write(Buffer.from(value));
    }
    return res.end();
  }catch(e){
    console.error('Homie photo:',e);
    if(res.headersSent)return res.end();
    return res.status(500).json({error:e?.message||'照片讀取失敗'});
  }
}
