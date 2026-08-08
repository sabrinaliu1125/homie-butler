import { get } from '@vercel/blob';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const {pin,pathname}=req.body||{};
  if(String(pin||'').trim()!==String(process.env.HOMIE_FAMILY_PIN||'').trim())
    return res.status(401).json({error:'Unauthorized'});

  const path=String(pathname||'');
  if(!path.startsWith('homie/completions/'))
    return res.status(400).json({error:'Invalid photo path'});

  const token=process.env.BLOB_READ_WRITE_TOKEN;
  if(!token)return res.status(503).json({error:'照片儲存尚未連接'});

  try{
    const result=await get(path,{access:'private',token});
    if(!result)return res.status(404).json({error:'Photo not found'});

    const ab=await new Response(result.stream).arrayBuffer();
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Cache-Control','private, max-age=300');
    return res.status(200).send(Buffer.from(ab));
  }catch(e){
    console.error('Homie photo:',e);
    return res.status(500).json({error:'照片讀取失敗'});
  }
}
