export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {text,pin}=req.body||{};
    if(String(pin||'').trim()!==String(process.env.HOMIE_FAMILY_PIN||'').trim())
      return res.status(401).json({error:'Unauthorized'});
    const input=String(text||'').trim();
    if(!input) return res.status(400).json({error:'No text'});
    const key=String(process.env.OPENAI_API_KEY||'').trim();
    if(!key) return res.status(503).json({error:'AI translation is not connected'});
    const hasChinese=/[\u3400-\u9FFF]/.test(input);
    const target=hasChinese?'Indonesian':'Traditional Chinese (Taiwan)';
    const r=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({
        model:'gpt-5.6-luna',
        input:`Translate the following household-management text into ${target}. Preserve names, numbers, times, emojis and meaning. Return only the translation.\n\n${input}`,
        max_output_tokens:300
      })
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Translation failed'});
    let translated=(data.output_text||'').trim();
    if(!translated && Array.isArray(data.output)){
      translated=data.output.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('').trim();
    }
    if(!translated) return res.status(500).json({error:'Empty translation'});
    return res.status(200).json({ok:true,translated,translation:translated,direction:hasChinese?'zh-id':'id-zh'});
  }catch(e){
    console.error('Homie translate:',e);
    return res.status(500).json({error:'Translation failed'});
  }
}