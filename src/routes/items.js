const e=require("express"),db=require("../db"),auth=require("../middleware/auth");
const {importProduct}=require("../services/productImporter");
const {projectAccess,canEdit}=require("../services/permissions");
const r=e.Router(); r.use(auth);

function validate(d){
  if(!d.name)return "Nome obrigatório.";
  if(d.status==="ESCOLHIDO"&&(!Number(d.found_price)||!d.product_url))return "Escolhido exige preço e link.";
  if(d.status==="COMPRADO"&&(!Number(d.paid_price)||!d.purchased_at||!d.payment_method))return "Compra exige preço pago, data e pagamento.";
  return null;
}

r.post("/import-url",async(q,s)=>{
  const url=String(q.body.url||"").trim();
  try{ new URL(url); }catch{return s.status(400).json({error:"URL inválida."})}
  try{s.json(await importProduct(url))}
  catch(x){
    // URL nunca é perdida: devolve fallback editável.
    let host="";
    try{host=new URL(url).hostname.replace(/^www\./,"")}catch{}
    s.json({url,store:host,name:"",description:"",image:"",price:null,partial:true,warning:"A loja bloqueou a leitura automática. O link foi preservado."});
  }
});

r.get("/project/:id",async(q,s)=>{
  try{
    const access=await projectAccess(q.params.id,q.user.id);
    if(!access)return s.sendStatus(403);
    s.json((await db.query("SELECT * FROM items WHERE project_id=$1 ORDER BY created_at DESC",[q.params.id])).rows);
  }catch(x){console.error(x);s.status(500).json({error:"Falha ao carregar itens."})}
});

r.post("/",async(q,s)=>{
  try{
    const d=q.body, access=await projectAccess(d.project_id,q.user.id);
    if(!canEdit(access))return s.status(403).json({error:"Você não tem permissão para adicionar itens neste projeto."});
    const err=validate(d); if(err)return s.status(400).json({error:err});
    const x=await db.query(`INSERT INTO items(project_id,name,description,quantity,planned_price,found_price,paid_price,status,store,product_url,image_url,purchased_at,payment_status,payment_method,installments,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [d.project_id,d.name,d.description||"",+d.quantity||1,+d.planned_price||0,+d.found_price||0,+d.paid_price||0,d.status||"A_ESCOLHER",d.store||"",d.product_url||"",d.image_url||"",d.purchased_at||null,d.payment_status||"NAO_SE_APLICA",d.payment_method||"",+d.installments||1,d.notes||""]);
    if(+d.found_price>0)await db.query("INSERT INTO price_history(item_id,price)VALUES($1,$2)",[x.rows[0].id,d.found_price]);
    s.json(x.rows[0]);
  }catch(x){console.error(x);s.status(500).json({error:"Falha ao salvar item."})}
});

r.put("/:id",async(q,s)=>{
  try{
    const item=(await db.query("SELECT * FROM items WHERE id=$1",[q.params.id])).rows[0];
    if(!item)return s.status(404).json({error:"Item não encontrado."});
    const access=await projectAccess(item.project_id,q.user.id);
    if(!canEdit(access))return s.status(403).json({error:"Você não tem permissão para editar este item."});
    const d={...item,...q.body,project_id:item.project_id};
    const err=validate(d); if(err)return s.status(400).json({error:err});
    const x=await db.query(`UPDATE items SET name=$1,description=$2,quantity=$3,planned_price=$4,found_price=$5,paid_price=$6,status=$7,store=$8,product_url=$9,image_url=$10,purchased_at=$11,payment_status=$12,payment_method=$13,installments=$14,notes=$15,updated_at=NOW() WHERE id=$16 RETURNING *`,
      [d.name,d.description||"",+d.quantity||1,+d.planned_price||0,+d.found_price||0,+d.paid_price||0,d.status||"A_ESCOLHER",d.store||"",d.product_url||"",d.image_url||"",d.purchased_at||null,d.payment_status||"NAO_SE_APLICA",d.payment_method||"",+d.installments||1,d.notes||"",q.params.id]);
    if(+d.found_price>0 && Number(d.found_price)!==Number(item.found_price))await db.query("INSERT INTO price_history(item_id,price)VALUES($1,$2)",[item.id,d.found_price]);
    s.json(x.rows[0]);
  }catch(x){console.error(x);s.status(500).json({error:"Falha ao editar item."})}
});

r.delete("/:id",async(q,s)=>{
  try{
    const item=(await db.query("SELECT project_id FROM items WHERE id=$1",[q.params.id])).rows[0];
    if(!item)return s.status(404).json({error:"Item não encontrado."});
    const access=await projectAccess(item.project_id,q.user.id);
    if(!canEdit(access))return s.status(403).json({error:"Você não tem permissão para excluir este item."});
    await db.query("DELETE FROM items WHERE id=$1",[q.params.id]);
    s.json({ok:true});
  }catch(x){console.error(x);s.status(500).json({error:"Falha ao excluir item."})}
});

module.exports=r;
