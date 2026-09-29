const express=require("express");
const db=require("../db");
const auth=require("../middleware/auth");
const {projectAccess,isOwner}=require("../services/permissions");
const r=express.Router();
r.use(auth);

r.get("/",async(req,res)=>{
  try{
    const q=await db.query(`
      SELECT p.*,
             CASE WHEN p.owner_id=$1 THEN 'OWNER' ELSE pm.role END AS my_role,
             (p.owner_id=$1) AS is_owner,
             COUNT(DISTINCT i.id)::int item_count,
             COALESCE(SUM(CASE WHEN i.status<>'CANCELADO'
               THEN COALESCE(NULLIF(i.found_price,0),i.planned_price)*i.quantity ELSE 0 END),0) planned,
             COALESCE(SUM(CASE WHEN i.status='COMPRADO'
               THEN i.paid_price*i.quantity ELSE 0 END),0) purchased
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
        LEFT JOIN items i ON i.project_id=p.id
       WHERE p.owner_id=$1 OR pm.user_id=$1
       GROUP BY p.id,pm.role
       ORDER BY p.created_at DESC
    `,[req.user.id]);
    res.json(q.rows);
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao carregar projetos."})}
});

r.post("/",async(req,res)=>{
  try{
    const {name,template,budget}=req.body;
    if(!name)return res.status(400).json({error:"Nome obrigatório."});
    const q=await db.query(
      "INSERT INTO projects(owner_id,name,template,budget)VALUES($1,$2,$3,$4)RETURNING *, 'OWNER'::text AS my_role, true AS is_owner",
      [req.user.id,name,template||"Personalizado",Number(budget)||0]
    );
    res.json(q.rows[0]);
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao criar projeto."})}
});

r.get("/:id/members",async(req,res)=>{
  try{
    const access=await projectAccess(req.params.id,req.user.id);
    if(!access)return res.sendStatus(403);
    const owner=(await db.query(`
      SELECT u.id,u.name,u.email,'OWNER'::text role
      FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=$1
    `,[req.params.id])).rows;
    const members=(await db.query(`
      SELECT u.id,u.name,u.email,pm.role
      FROM project_members pm JOIN users u ON u.id=pm.user_id
      WHERE pm.project_id=$1 ORDER BY u.name
    `,[req.params.id])).rows;
    res.json({my_role:access.role,members:[...owner,...members]});
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao carregar participantes."})}
});

r.post("/:id/members",async(req,res)=>{
  try{
    const access=await projectAccess(req.params.id,req.user.id);
    if(!isOwner(access))return res.status(403).json({error:"Somente o dono pode adicionar participantes."});
    const email=String(req.body.email||"").trim().toLowerCase();
    const role=["EDITOR","VIEWER"].includes(req.body.role)?req.body.role:"VIEWER";
    if(!email)return res.status(400).json({error:"Informe o e-mail."});
    const user=(await db.query("SELECT id,name,email FROM users WHERE email=$1",[email])).rows[0];
    if(!user)return res.status(404).json({error:"Esse e-mail ainda não possui conta no CompraKi."});
    if(Number(user.id)===Number(req.user.id))return res.status(400).json({error:"Você já é o dono deste projeto."});
    await db.query(`
      INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)
      ON CONFLICT(project_id,user_id) DO UPDATE SET role=EXCLUDED.role
    `,[req.params.id,user.id,role]);
    res.json({ok:true,user:{...user,role}});
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao adicionar participante."})}
});

r.patch("/:id/members/:userId",async(req,res)=>{
  try{
    const access=await projectAccess(req.params.id,req.user.id);
    if(!isOwner(access))return res.status(403).json({error:"Somente o dono pode alterar permissões."});
    const role=["EDITOR","VIEWER"].includes(req.body.role)?req.body.role:null;
    if(!role)return res.status(400).json({error:"Permissão inválida."});
    const q=await db.query("UPDATE project_members SET role=$1 WHERE project_id=$2 AND user_id=$3 RETURNING *",
      [role,req.params.id,req.params.userId]);
    if(!q.rowCount)return res.status(404).json({error:"Participante não encontrado."});
    res.json(q.rows[0]);
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao alterar permissão."})}
});

r.delete("/:id/members/:userId",async(req,res)=>{
  try{
    const access=await projectAccess(req.params.id,req.user.id);
    if(!isOwner(access))return res.status(403).json({error:"Somente o dono pode remover participantes."});
    const q=await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING user_id",
      [req.params.id,req.params.userId]);
    if(!q.rowCount)return res.status(404).json({error:"Participante não encontrado."});
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:"Falha ao remover participante."})}
});

r.delete("/:id",async(req,res)=>{
  try{
    const access=await projectAccess(req.params.id,req.user.id);
    if(!isOwner(access))return res.status(403).json({error:"Somente o dono pode excluir o projeto."});
    const q=await db.query("DELETE FROM projects WHERE id=$1 RETURNING id,name",[req.params.id]);
    res.json({ok:true,project:q.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:"Não foi possível excluir o projeto."})}
});

module.exports=r;
