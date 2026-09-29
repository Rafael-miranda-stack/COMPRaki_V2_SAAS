const express=require("express"),db=require("../db"),auth=require("../middleware/auth");const r=express.Router();r.use(auth);

async function access(userId,projectId){
  const q=await db.query(`SELECT p.owner_id,
    CASE WHEN p.owner_id=$2 THEN 'OWNER' ELSE m.role END AS role
    FROM projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=$2
    WHERE p.id=$1 AND (p.owner_id=$2 OR m.user_id=$2) LIMIT 1`,[projectId,userId]);
  return q.rows[0]||null;
}
async function owner(userId,projectId){
  const q=await db.query("SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2",[projectId,userId]);
  return q.rowCount>0;
}

r.get("/",async(req,res)=>{const q=await db.query(`SELECT p.*,COUNT(i.id)::int item_count,COALESCE(SUM(CASE WHEN i.status<>'CANCELADO' THEN COALESCE(NULLIF(i.found_price,0),i.planned_price)*i.quantity ELSE 0 END),0) planned,COALESCE(SUM(CASE WHEN i.status='COMPRADO' THEN i.paid_price*i.quantity ELSE 0 END),0) purchased FROM projects p LEFT JOIN items i ON i.project_id=p.id WHERE p.owner_id=$1 OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1) GROUP BY p.id ORDER BY p.created_at DESC`,[req.user.id]);res.json(q.rows);});
r.post("/",async(req,res)=>{const{name,template,budget}=req.body;if(!name)return res.status(400).json({error:"Nome obrigatório."});const q=await db.query("INSERT INTO projects(owner_id,name,template,budget)VALUES($1,$2,$3,$4)RETURNING *",[req.user.id,name,template||"Personalizado",Number(budget)||0]);res.json(q.rows[0]);});

r.get("/:id/members",async(req,res)=>{
  try{
    const a=await access(req.user.id,req.params.id);
    if(!a)return res.status(403).json({error:"Sem acesso a este projeto."});
    const q=await db.query(`SELECT u.id AS user_id,u.name,u.email,'OWNER' AS role,true AS is_owner
      FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=$1
      UNION ALL
      SELECT u.id AS user_id,u.name,u.email,m.role,false AS is_owner
      FROM project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=$1
      ORDER BY is_owner DESC,name`,[req.params.id]);
    res.json({can_manage:a.role==="OWNER",members:q.rows});
  }catch(e){console.error("members-list:",e);res.status(500).json({error:"Não foi possível carregar os participantes."})}
});
r.post("/:id/members",async(req,res)=>{
  try{
    if(!await owner(req.user.id,req.params.id))return res.status(403).json({error:"Somente o proprietário pode gerenciar participantes."});
    const email=String(req.body.email||"").trim().toLowerCase(),role=["VIEWER","EDITOR"].includes(req.body.role)?req.body.role:"VIEWER";
    if(!email)return res.status(400).json({error:"Informe o e-mail."});
    const u=await db.query("SELECT id,name,email FROM users WHERE LOWER(email)=LOWER($1)",[email]);
    if(!u.rowCount)return res.status(404).json({error:"Este e-mail ainda não possui conta no CompraKi."});
    const p=await db.query("SELECT owner_id FROM projects WHERE id=$1",[req.params.id]);
    if(Number(p.rows[0].owner_id)===Number(u.rows[0].id))return res.status(400).json({error:"Este usuário já é o proprietário do projeto."});
    await db.query(`INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)
      ON CONFLICT(project_id,user_id) DO UPDATE SET role=EXCLUDED.role`,[req.params.id,u.rows[0].id,role]);
    res.json({ok:true});
  }catch(e){console.error("members-add:",e);res.status(500).json({error:"Não foi possível adicionar o participante."})}
});
r.patch("/:id/members/:userId",async(req,res)=>{
  try{
    if(!await owner(req.user.id,req.params.id))return res.status(403).json({error:"Somente o proprietário pode gerenciar participantes."});
    const role=req.body.role;if(!["VIEWER","EDITOR"].includes(role))return res.status(400).json({error:"Permissão inválida."});
    const q=await db.query("UPDATE project_members SET role=$1 WHERE project_id=$2 AND user_id=$3 RETURNING *",[role,req.params.id,req.params.userId]);
    if(!q.rowCount)return res.status(404).json({error:"Participante não encontrado."});
    res.json({ok:true});
  }catch(e){console.error("members-update:",e);res.status(500).json({error:"Não foi possível atualizar a permissão."})}
});
r.delete("/:id/members/:userId",async(req,res)=>{
  try{
    if(!await owner(req.user.id,req.params.id))return res.status(403).json({error:"Somente o proprietário pode gerenciar participantes."});
    await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[req.params.id,req.params.userId]);
    res.json({ok:true});
  }catch(e){console.error("members-delete:",e);res.status(500).json({error:"Não foi possível remover o participante."})}
});

r.delete("/:id",async(req,res)=>{try{const q=await db.query("DELETE FROM projects WHERE id=$1 AND owner_id=$2 RETURNING id,name",[req.params.id,req.user.id]);if(!q.rowCount)return res.status(404).json({error:"Projeto não encontrado ou você não é o proprietário."});res.json({ok:true,project:q.rows[0]});}catch(e){console.error(e);res.status(500).json({error:"Não foi possível excluir o projeto."});}});
module.exports=r;
