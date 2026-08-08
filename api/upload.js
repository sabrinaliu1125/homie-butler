import { put } from '@vercel/blob';
import formidable from 'formidable';
import fs from 'node:fs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const token=String(process.env.BLOB_READ_WRITE_TOKEN||'').trim();
  if(!token) return res.status(503).json({error:'照片儲存尚未連接'});
  const form=formidable({maxFileSize:3.5*1024*1024,maxFiles:1,allowEmptyFiles:false});
  form.parse(req,async(err,fields,files)=>{
    try{
      if(err) return res.status(400).json({error:'照片格式或大小不符合'});
      const pin=String(Array.isArray(fields.pin)?fields.pin[0]:fields.pin||'').trim();
      if(pin!==String(process.env.HOMIE_FAMILY_PIN||'').trim()) return res.status(401).json({error:'Unauthorized'});
      const f=Array.isArray(files.file)?files.file[0]:files.file;
      if(!f) return res.status(400).json({error:'沒有收到照片'});
      const mime=String(f.mimetype||'');
      if(!mime.startsWith('image/')) return res.status(400).json({error:'只能上傳照片'});
      const buf=await fs.promises.readFile(f.filepath);
      const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';
      const pathname=`homie/completions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const blob=await put(pathname,buf,{access:'private',token,contentType:mime||'image/jpeg',addRandomSuffix:false});
      return res.status(200).json({ok:true,pathname:blob.pathname});
    }catch(e){
      console.error('Homie upload:',e);
      return res.status(500).json({error:e?.message||'照片上傳失敗'});
    }
  });
}