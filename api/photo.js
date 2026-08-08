import { get } from '@vercel/blob';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const {pin,pathname}=req.body||{};
  if(String(pin||'').trim()!==String(process.env.HOMIE_FAMILY_PIN||'').trim())
    return res.status(401).json({error:'Unauthorized'});

  const path=String(pathname||'').trim();
  if(!path.startsWith('homie/completions/'))
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

    // @vercel/blob get() returns a Web ReadableStream.
    // Stream it chunk-by-chunk into the Node/Pages API response.
    const reader=result.stream.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value)res.write(Buffer.from(value));
    }
    return res.end();
  }catch(e){
    console.error('Homie photo:',e);
    return res.status(500).json({error:e?.message||'照片讀取失敗'});
  }
}
