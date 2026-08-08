import { put } from '@vercel/blob';
import formidable from 'formidable';
import fs from 'node:fs';

export const config={api:{bodyParser:false}};

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const token=process.env.BLOB_READ_WRITE_TOKEN;
  if(!token)return res.status(503).json({error:'照片儲存尚未連接'});

  const form=formidable({
    maxFileSize:3.5*1024*1024,
    maxFiles:1,
    filter:part=>part.mimetype?.startsWith('image/')===true
  });

  form.parse(req,async(err,fields,files)=>{
    try{
      if(err)throw err;
      const pin=String(Array.isArray(fields.pin)?fields.pin[0]:fields.pin||'').trim();
      if(pin!==String(process.env.HOMIE_FAMILY_PIN||'').trim())
        return res.status(401).json({error:'Unauthorized'});

      const f=Array.isArray(files.file)?files.file[0]:files.file;
      if(!f)return res.status(400).json({error:'沒有收到照片'});
      const buf=fs.readFileSync(f.filepath);

      const pathname=`homie/completions/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const blob=await put(pathname,buf,{
        access:'private',
        contentType:'image/jpeg',
        token
      });

      return res.status(200).json({pathname:blob.pathname});
    }catch(e){
      console.error('Homie upload:',e);
      return res.status(500).json({error:'照片上傳失敗'});
    }
  });
}
