import { put } from '@vercel/blob';

export const config={api:{bodyParser:false}};

async function readBody(req,maxBytes){
  const chunks=[];
  let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>maxBytes)throw new Error('PHOTO_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const pin=String(req.headers['x-homie-pin']||'').trim();
  const primaryPin=String(process.env.HOMIE_FAMILY_PIN||'').trim();
  const sisterPin=String(process.env.HOMIE_SISTER_PIN||'').trim();
  const familyId=primaryPin&&pin===primaryPin?'primary':(sisterPin&&sisterPin!==primaryPin&&pin===sisterPin?'sister':null);
  if(!familyId)return res.status(401).json({error:'Unauthorized'});

  const contentType=String(req.headers['content-type']||'').split(';')[0].trim();
  if(!contentType.startsWith('image/'))return res.status(400).json({error:'只能上傳照片'});

  try{
    const body=await readBody(req,3.5*1024*1024);
    if(!body.length)return res.status(400).json({error:'沒有收到照片'});

    const ext=contentType.includes('png')?'png':contentType.includes('webp')?'webp':'jpg';
    const isPreview=process.env.VERCEL_ENV==='preview';
    const prefix=isPreview?'homie/preview/':'homie/';
    const familyPath=familyId==='primary'?'completions/':'sister/completions/';
    const pathname=`${prefix}${familyPath}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob=await put(pathname,body,{
      access:'private',
      contentType,
      addRandomSuffix:false,
      token:process.env.BLOB_READ_WRITE_TOKEN
    });
    return res.status(200).json({ok:true,pathname:blob.pathname});
  }catch(e){
    console.error('Homie upload:',e);
    if(e?.message==='PHOTO_TOO_LARGE')return res.status(413).json({error:'照片太大，請換一張照片'});
    return res.status(500).json({error:e?.message||'照片上傳失敗'});
  }
}
