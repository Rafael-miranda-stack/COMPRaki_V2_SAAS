let token=localStorage.getItem("compraki_token")||localStorage.getItem("token")||"",currentProject=null,projects=[],items=[],imported={};
const $=id=>document.getElementById(id);const brl=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function toast(m){let t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};let r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(r.status===401){logout();throw Error("Sua sessão expirou.")}if(!r.ok)throw Error(d.error||"Não foi possível concluir.");return d}
function parseJwt(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))}catch{return{}}}
function boot(){let on=!!token;$("auth").hidden=on;$("shell").hidden=!on;if(on){let u=parseJwt(token);$("userName").textContent=u.name||"Usuário";$("avatar").textContent=(u.name||"U")[0].toUpperCase();loadProjects()}}
async function login(){try{let d=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});token=d.token;localStorage.setItem("compraki_token",token);localStorage.setItem("token",token);boot()}catch(e){toast(e.message)}}
async function register(){try{let d=await api("/api/auth/register",{method:"POST",body:JSON.stringify({name:$("name").value,email:$("email").value,password:$("password").value})});token=d.token;localStorage.setItem("compraki_token",token);localStorage.setItem("token",token);boot()}catch(e){toast(e.message)}}
function logout(){localStorage.removeItem("compraki_token");localStorage.removeItem("token");token="";location.reload()}
function icon(t){let s=(t||"").toLowerCase();return s.includes("casa")?"🏠":s.includes("enxoval")?"🍼":s.includes("viagem")?"✈️":s.includes("casamento")?"💍":s.includes("setup")?"💻":s.includes("reforma")?"🛠️":"🛒"}
function card(p){let spent=Number(p.purchased||0),budget=Number(p.budget||0),pct=budget?Math.min(100,spent/budget*100):0;return `<article class="project-card" data-project-id="${p.id}"><div class="project-top"><div class="project-icon">${icon(p.template)}</div><span class="pill">${p.template||"Projeto"}</span></div><h3>${esc(p.name)}</h3><span class="muted">${p.item_count||0} produto(s)</span><div class="progress"><i style="width:${pct}%"></i></div><div class="project-money"><span>${brl(spent)} gastos</span><b>${brl(budget)}</b></div></article>`}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadProjects(){try{projects=await api("/api/projects");renderProjects()}catch(e){toast(e.message)}}
function renderProjects(){let budget=projects.reduce((a,p)=>a+Number(p.budget||0),0),spent=projects.reduce((a,p)=>a+Number(p.purchased||0),0),count=projects.reduce((a,p)=>a+Number(p.item_count||0),0);$("globalStats").innerHTML=stat("Orçamento total",brl(budget))+stat("Total comprado",brl(spent))+stat("Saldo planejado",brl(budget-spent))+stat("Produtos",count);let html=projects.map(card).join("")||empty("Você ainda não criou nenhum projeto.");$("recentProjects").innerHTML=projects.slice(0,4).map(card).join("")||html;$("allProjects").innerHTML=html;bindProjectCards()}
function stat(l,v){return `<div class="stat"><small>${l}</small><b>${v}</b></div>`}function empty(t){return `<div class="empty"><b>${t}</b><p>Use o botão acima para começar.</p></div>`}
function bindProjectCards(){document.querySelectorAll(".project-card").forEach(el=>el.addEventListener("click",()=>openProject(Number(el.dataset.projectId))))}
function showView(name){["homeView","projectsView","projectView","accountView"].forEach(x=>$(x).hidden=true);$(name+"View").hidden=false;document.querySelectorAll(".nav[data-view]").forEach(n=>n.classList.toggle("active",n.dataset.view===name));$("pageTitle").textContent={home:"Visão geral",projects:"Projetos",project:"Projeto",account:"Minha conta"}[name]||"CompraKi"}
async function openProject(id){currentProject=projects.find(p=>Number(p.id)===Number(id));if(!currentProject)return toast("Projeto não encontrado.");$("projectName").textContent=currentProject.name;$("projectTemplate").textContent=currentProject.template||"Projeto";showView("project");await loadItems()}
async function loadItems(){try{items=await api("/api/items/project/"+currentProject.id);renderItems()}catch(e){toast(e.message)}}
function renderItems(){let q=$("itemSearch").value.toLowerCase(),f=$("statusFilter").value,list=items.filter(x=>(!f||x.status===f)&&(!q||(x.name||"").toLowerCase().includes(q)||(x.store||"").toLowerCase().includes(q)));let planned=items.filter(x=>x.status!=="CANCELADO").reduce((a,x)=>a+(Number(x.found_price)||Number(x.planned_price)||0)*Number(x.quantity||1),0),spent=items.filter(x=>x.status==="COMPRADO").reduce((a,x)=>a+Number(x.paid_price||0)*Number(x.quantity||1),0),budget=Number(currentProject.budget||0),free=budget-planned;$("projectStats").innerHTML=stat("Orçamento",brl(budget))+stat("Planejado",brl(planned))+stat("Comprado",brl(spent))+`<div class="stat"><small>Livre para planejar</small><b>${brl(free)}</b><div class="budget-note">Orçamento menos itens planejados</div></div>`;$("itemsGrid").innerHTML=list.map(productCard).join("")||empty(items.length?"Nenhum item corresponde ao filtro.":"Adicione o primeiro produto deste projeto.")}function productCard(x){let price=x.status==="COMPRADO"?x.paid_price:(x.found_price||x.planned_price),url=x.product_url&&/^https?:\/\//i.test(x.product_url)?x.product_url:"";return `<article class="product-card"><div class="product-img">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.name)}">`:"<span style='font-size:42px'>🛍️</span>"}</div><div class="product-body"><div><span class="tag">${labelStatus(x.status)}</span></div><h3>${esc(x.name)}</h3><div class="product-store">${esc(x.store||"Loja não informada")} • Qtd. ${x.quantity||1}</div><div class="product-price">${brl(price)}</div><div class="product-actions">${url?`<a class="shop-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir na loja ↗</a>`:""}<button class="edit-placeholder" type="button" onclick="editItem(${x.id})">Editar</button></div></div></article>`}function labelStatus(s){return {A_ESCOLHER:"A escolher",ESCOLHIDO:"Escolhido",COMPRADO:"Comprado",CANCELADO:"Cancelado"}[s]||s}
function newProject(){$("projectForm").reset();$("projectDlg").showModal()}
async function createProject(e){e.preventDefault();try{await api("/api/projects",{method:"POST",body:JSON.stringify({name:$("pname").value,template:$("ptemplate").value,budget:$("pbudget").value})});$("projectDlg").close();toast("Projeto criado.");await loadProjects()}catch(e){toast(e.message)}}
function newItem(){imported={};$("itemForm").reset();$("itemProjectId").value=currentProject.id;$("editItemId").value="";$("iqty").value=1;$("iinstallments").value=1;$("preview").innerHTML="";$("importStatus").textContent="";$("itemDialogEyebrow").textContent="NOVO PRODUTO";$("itemDialogTitle").textContent="Adicionar ao projeto";$("deleteItemBtn").hidden=true;togglePurchase();$("itemDlg").showModal()}
function editItem(id){const x=items.find(i=>Number(i.id)===Number(id));if(!x)return toast("Produto não encontrado.");imported={image:x.image_url||""};$("itemForm").reset();$("itemProjectId").value=currentProject.id;$("editItemId").value=x.id;$("url").value=x.product_url||"";$("iname").value=x.name||"";$("idesc").value=x.description||"";$("iqty").value=x.quantity||1;$("iplanned").value=x.planned_price||"";$("ifound").value=x.found_price||"";$("istore").value=x.store||"";$("istatus").value=x.status||"A_ESCOLHER";$("ipaid").value=x.paid_price||"";$("idate").value=x.purchased_at?String(x.purchased_at).slice(0,10):"";$("ipay").value=x.payment_method||"";$("iinstallments").value=x.installments||1;$("preview").innerHTML=x.image_url?`<img src="${esc(x.image_url)}" alt="">`:"";$("importStatus").textContent="";$("itemDialogEyebrow").textContent="EDITAR PRODUTO";$("itemDialogTitle").textContent=x.name||"Editar produto";$("deleteItemBtn").hidden=false;togglePurchase();$("itemDlg").showModal()}
async function deleteItem(){const id=$("editItemId").value;if(!id)return;try{await api("/api/items/"+id,{method:"DELETE"});$("itemDlg").close();toast("Produto excluído.");await loadItems();await loadProjects()}catch(e){toast(e.message)}}
async function importUrl(){let url=$("url").value;if(!url)return toast("Cole o link do produto.");$("importStatus").textContent="Buscando dados do produto...";$("importBtn").disabled=true;try{imported=await api("/api/items/import-url",{method:"POST",body:JSON.stringify({url})});$("iname").value=imported.name||"";$("idesc").value=imported.description||"";$("ifound").value=imported.price||"";$("istore").value=imported.store||"";$("istatus").value="ESCOLHIDO";$("preview").innerHTML=`<div class="preview-card">${imported.image?`<img src="${esc(imported.image)}">`:""}<div><b>${esc(imported.name||"Produto encontrado")}</b><br><small>${imported.price?brl(imported.price):"Preço não identificado — você pode preencher manualmente."}</small></div></div>`;$("importStatus").textContent="Dados encontrados. Confira antes de salvar."}catch(e){$("importStatus").textContent="Não consegui ler automaticamente. Você pode preencher os dados manualmente.";toast(e.message)}finally{$("importBtn").disabled=false;togglePurchase()}}
function togglePurchase(){$("purchaseFields").hidden=$("istatus").value!=="COMPRADO"}
async function saveItem(e){e.preventDefault();try{let st=$("istatus").value,id=$("editItemId").value,d={project_id:Number($("itemProjectId").value||currentProject.id),name:$("iname").value,description:$("idesc").value,quantity:$("iqty").value,planned_price:$("iplanned").value,found_price:$("ifound").value,paid_price:$("ipaid").value,status:st,store:$("istore").value,product_url:$("url").value,image_url:imported.image||"",purchased_at:$("idate").value||null,payment_status:st==="COMPRADO"?"PENDENTE":"NAO_SE_APLICA",payment_method:$("ipay").value,installments:$("iinstallments").value};await api(id?"/api/items/"+id:"/api/items",{method:id?"PUT":"POST",body:JSON.stringify(d)});$("itemDlg").close();toast(id?"Produto atualizado.":"Produto adicionado.");await loadItems();await loadProjects();currentProject=projects.find(p=>Number(p.id)===Number(d.project_id))||currentProject}catch(e){toast(e.message)}}
function askDeleteProject(){if(!currentProject)return;$("confirmText").textContent=`O projeto "${currentProject.name}" e todos os produtos dele serão excluídos. Esta ação não pode ser desfeita.`;$("confirmDlg").showModal()}
async function deleteProject(){if(!currentProject)return;let id=currentProject.id;$("confirmDeleteBtn").disabled=true;$("confirmDeleteBtn").textContent="Excluindo...";try{await api("/api/projects/"+id,{method:"DELETE"});$("confirmDlg").close();currentProject=null;await loadProjects();showView("projects");toast("Projeto excluído.")}catch(e){toast(e.message)}finally{$("confirmDeleteBtn").disabled=false;$("confirmDeleteBtn").textContent="Excluir definitivamente"}}
function setAuthMode(mode){
  const registering=mode==="register";
  $("nameField").hidden=!registering;
  $("loginBtn").hidden=registering;
  $("registerSubmitBtn").hidden=!registering;
  $("registerBtn").hidden=registering;
  $("backToLoginBtn").hidden=!registering;
  $("forgotPasswordBtn").parentElement.hidden=registering;
  $("authSwitchText").textContent=registering?"Já possui uma conta?":"Ainda não tem uma conta?";
  $("authEyebrow").textContent=registering?"CRIAR CONTA":"ACESSO À CONTA";
  $("authTitle").textContent=registering?"Crie sua conta":"Bem-vindo de volta!";
  $("authSubtitle").textContent=registering?"Comece a organizar seus projetos e compras.":"Entre para continuar organizando seus projetos.";
  $("password").autocomplete=registering?"new-password":"current-password";
  if(registering) $("name").focus(); else $("email").focus();
}


async function openMembers(){
  if(!currentProject)return toast("Abra um projeto primeiro.");
  try{
    await loadMembers();
    $("membersDlg").showModal();
  }catch(e){toast(e.message)}
}
async function loadMembers(){
  const list=await api("/api/projects/"+currentProject.id+"/members");
  $("memberInvite").hidden=!list.can_manage;
  $("memberList").innerHTML=list.members.map(m=>`<div class="member-row">
    <div><b>${esc(m.name||m.email)}</b><small>${esc(m.email)}${m.is_owner?" • Proprietário":""}</small></div>
    ${m.is_owner?`<span class="pill">OWNER</span>`:`<select class="member-role" data-user-id="${m.user_id}" ${list.can_manage?"":"disabled"}><option value="VIEWER" ${m.role==="VIEWER"?"selected":""}>Visualizador</option><option value="EDITOR" ${m.role==="EDITOR"?"selected":""}>Editor</option></select>`}
    ${(!m.is_owner&&list.can_manage)?`<button type="button" class="danger member-remove" data-user-id="${m.user_id}">Remover</button>`:""}
  </div>`).join("")||"<div class='empty'><b>Nenhum participante.</b></div>";
  document.querySelectorAll(".member-role").forEach(el=>el.onchange=()=>updateMember(el.dataset.userId,el.value));
  document.querySelectorAll(".member-remove").forEach(el=>el.onclick=()=>removeMember(el.dataset.userId));
}
async function addMember(){
  const email=$("memberEmail").value.trim();
  if(!email)return toast("Informe o e-mail do colaborador.");
  try{
    await api("/api/projects/"+currentProject.id+"/members",{method:"POST",body:JSON.stringify({email,role:$("memberRole").value})});
    $("memberEmail").value="";
    toast("Acesso atualizado.");
    await loadMembers();
  }catch(e){toast(e.message)}
}
async function updateMember(userId,role){
  try{
    await api("/api/projects/"+currentProject.id+"/members/"+userId,{method:"PATCH",body:JSON.stringify({role})});
    toast("Permissão atualizada.");
    await loadMembers();
  }catch(e){toast(e.message)}
}
async function removeMember(userId){
  try{
    await api("/api/projects/"+currentProject.id+"/members/"+userId,{method:"DELETE"});
    toast("Participante removido.");
    await loadMembers();
  }catch(e){toast(e.message)}
}

document.addEventListener("DOMContentLoaded",()=>{$("loginBtn").onclick=login;$("registerBtn").onclick=()=>setAuthMode("register");$("registerSubmitBtn").onclick=register;$("backToLoginBtn").onclick=()=>setAuthMode("login");$("togglePassword").onclick=()=>{const p=$("password"),show=p.type==="password";p.type=show?"text":"password";$("togglePassword").setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha");$("togglePassword").title=show?"Ocultar senha":"Mostrar senha"};$("logoutBtn").onclick=logout;document.querySelectorAll(".new-project").forEach(b=>b.onclick=newProject);document.querySelector(".close-project").onclick=()=>$("projectDlg").close();document.querySelector(".close-item").onclick=()=>$("itemDlg").close();$("projectForm").onsubmit=createProject;$("itemForm").onsubmit=saveItem;$("newItemBtn").onclick=newItem;$("deleteItemBtn").onclick=deleteItem;$("deleteProjectBtn").onclick=askDeleteProject;$("membersBtn").onclick=openMembers;document.querySelector(".close-members").onclick=()=>$("membersDlg").close();$("addMemberBtn").onclick=addMember;$("cancelDeleteBtn").onclick=()=>$("confirmDlg").close();$("confirmDeleteBtn").onclick=deleteProject;$("importBtn").onclick=importUrl;$("istatus").onchange=togglePurchase;$("backBtn").onclick=()=>showView("projects");$("itemSearch").oninput=renderItems;$("statusFilter").onchange=renderItems;document.querySelectorAll(".nav[data-view]").forEach(n=>n.onclick=()=>showView(n.dataset.view));document.querySelectorAll("[data-go]").forEach(n=>n.onclick=()=>showView(n.dataset.go));boot()});
// Segurança da conta: recuperação e alteração de senha
async function requestPasswordReset(e){
  e.preventDefault();
  const btn=$("sendResetBtn");
  btn.disabled=true;btn.textContent="Enviando...";
  try{
    const d=await api("/api/auth/forgot-password",{method:"POST",body:JSON.stringify({email:$("forgotEmail").value})});
    $("forgotPasswordDlg").close();
    toast(d.message||"Se o e-mail estiver cadastrado, enviaremos o link de recuperação.");
  }catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="Enviar link de recuperação"}
}
async function resetPasswordFromLink(e){
  e.preventDefault();
  const p=$("resetPassword").value,c=$("resetPasswordConfirm").value;
  if(p.length<8)return toast("A nova senha deve ter pelo menos 8 caracteres.");
  if(p!==c)return toast("As senhas não coincidem.");
  const resetToken=new URLSearchParams(location.search).get("reset_token");
  const btn=$("resetPasswordBtn");btn.disabled=true;btn.textContent="Salvando...";
  try{
    const d=await api("/api/auth/reset-password",{method:"POST",body:JSON.stringify({token:resetToken,password:p})});
    localStorage.removeItem("compraki_token");localStorage.removeItem("token");token="";
    history.replaceState({},"",location.pathname);
    $("resetPasswordDlg").close();
    $("auth").hidden=false;$("shell").hidden=true;
    $("password").value="";
    toast(d.message||"Senha redefinida com sucesso.");
  }catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="Salvar nova senha"}
}
async function changePassword(e){
  e.preventDefault();
  const current=$("currentPassword").value,n=$("newPassword").value,c=$("confirmNewPassword").value;
  if(n.length<8)return toast("A nova senha deve ter pelo menos 8 caracteres.");
  if(n!==c)return toast("A confirmação da nova senha não confere.");
  const btn=$("changePasswordBtn");btn.disabled=true;btn.textContent="Alterando...";
  try{
    const d=await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword:current,newPassword:n})});
    $("changePasswordForm").reset();toast(d.message||"Senha alterada com sucesso.");
  }catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="Alterar senha"}
}
document.addEventListener("DOMContentLoaded",()=>{
  $("forgotPasswordBtn").onclick=()=>{$("forgotEmail").value=$("email").value||"";$("forgotPasswordDlg").showModal()};
  document.querySelector(".close-forgot").onclick=()=>$("forgotPasswordDlg").close();
  $("forgotPasswordForm").onsubmit=requestPasswordReset;
  $("resetPasswordForm").onsubmit=resetPasswordFromLink;
  $("changePasswordForm").onsubmit=changePassword;
  const resetToken=new URLSearchParams(location.search).get("reset_token");
  if(resetToken){$("auth").hidden=false;$("shell").hidden=true;$("resetPasswordDlg").showModal()}
});
