import OpenAI from 'openai';
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {pin,text,target}=req.body||{};if(String(pin||'').trim()!==String(process.env.HOMIE_FAMILY_PIN||'').trim())return res.status(401).json({error:'Unauthorized'});
 if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY 尚未設定'});
 if(!text||!['id','zh-TW'].includes(target))return res.status(400).json({error:'Invalid request'});
 const targetName=target==='id'?'natural Indonesian':'natural Traditional Chinese used in Taiwan';
 try{const r=await client.responses.create({model:'gpt-4.1-mini',instructions:`Translate the message faithfully into ${targetName}. Preserve names, times, numbers and household meaning. Return only the translation.`,input:String(text).slice(0,2000),max_output_tokens:300});return res.status(200).json({translation:(r.output_text||'').trim()})}catch(e){console.error(e);return res.status(500).json({error:'翻譯服務暫時失敗'})}
}
