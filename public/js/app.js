let token=localStorage.getItem("compraki_token")||localStorage.getItem("token")||"",currentProject=null,projects=[],items=[],imported={},deferredInstall=null;
const $=id=>document.getElementById(id),brl=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(r.status===401){logout();throw Error("Sua sessão expirou.")}if(!r.ok)throw Error(d.error||"Não foi possível concluir.");return d}
function parseJwt(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))}catch{return{}}}
function roleLabel(r){return {OWNER:"Dono",EDITOR:"Editor",VIEWER:"Visualizador"}[r]||r}
function canEdit(){return currentProject&&["OWNER","EDITOR"].includes(currentProject.my_role)}
function isOwner(){return currentProject&&currentProject.my_role==="OWNER"}

function boot(){const on=!!token;$("auth").hidden=on;$("shell").hidden=!on;if(on){const u=parseJwt(token);$("userName").textContent=u.name||"Usuário";$("avatar").textContent=(u.name||"U")[0].toUpperCase();loadProjects()}}

function setAuthMode(mode){
  const registering=mode==="register";
  $("nameField").hidden=!registering;
  $("loginBtn").hidden=registering;
  $("registerSubmitBtn").hidden=!registering;
  $("registerBtn").hidden=registering;
  $("backToLoginBtn").hidden=!registering;
  $("authSwitchText").textContent=registering?"Já possui uma conta?":"Ainda não tem uma conta?";
  $("authEyebrow").textContent=registering?"CRIAR CONTA":"ACESSO À CONTA";
  $("authTitle").textContent=registering?"Crie sua conta":"Bem-vindo de volta!";
  $("authSubtitle").textContent=registering?"Comece a organizar seus projetos e compras.":"Entre para continuar organizando seus projetos.";
  $("password").autocomplete=registering?"new-password":"current-password";
  if(!registering) $("name").value="";
}
function togglePasswordVisibility(){
  const input=$("password"),show=input.type==="password";
  input.type=show?"text":"password";
  $("togglePassword").textContent=show?"⊘":"◉";
  $("togglePassword").setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha");
  $("togglePassword").title=show?"Ocultar senha":"Mostrar senha";
}
async function login(){try{const d=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("email").value,password:$("password").value})});token=d.token;localStorage.setItem("compraki_token",token);localStorage.setItem("token",token);boot()}catch(e){toast(e.message)}}
async function register(){try{const d=await api("/api/auth/register",{method:"POST",body:JSON.stringify({name:$("name").value,email:$("email").value,password:$("password").value})});token=d.token;localStorage.setItem("compraki_token",token);localStorage.setItem("token",token);boot()}catch(e){toast(e.message)}}
function logout(){localStorage.removeItem("compraki_token");localStorage.removeItem("token");token="";location.reload()}
function icon(t){const s=(t||"").toLowerCase();return s.includes("casa")?"🏠":s.includes("enxoval")?"🍼":s.includes("viagem")?"✈️":s.includes("casamento")?"💍":s.includes("setup")?"💻":s.includes("carro")?"🚗":"🛒"}
function stat(l,v){return `<div class="stat"><small>${l}</small><b>${v}</b></div>`}
function empty(t){return `<div class="empty"><b>${t}</b><p>Use as opções disponíveis para continuar.</p></div>`}
function card(p){const spent=Number(p.purchased||0),budget=Number(p.budget||0),pct=budget?Math.min(100,spent/budget*100):0;return `<article class="project-card" data-project-id="${p.id}"><div class="project-top"><div class="project-icon">${icon(p.template)}</div><span class="role-badge ${p.my_role==="OWNER"?"owner":""}">${roleLabel(p.my_role)}</span></div><h3>${esc(p.name)}</h3><span class="muted">${p.item_count||0} produto(s)</span><div class="progress"><i style="width:${pct}%"></i></div><div class="project-money"><span>${brl(spent)} gastos</span><b>${brl(budget)}</b></div></article>`}
async function loadProjects(){try{projects=await api("/api/projects");renderProjects()}catch(e){toast(e.message)}}
function renderProjects(){
  const mine=projects.filter(p=>p.my_role==="OWNER"),shared=projects.filter(p=>p.my_role!=="OWNER");
  const budget=projects.reduce((a,p)=>a+Number(p.budget||0),0),spent=projects.reduce((a,p)=>a+Number(p.purchased||0),0),count=projects.reduce((a,p)=>a+Number(p.item_count||0),0);
  $("globalStats").innerHTML=stat("Orçamento total",brl(budget))+stat("Total comprado",brl(spent))+stat("Projetos",projects.length)+stat("Produtos",count);
  $("recentProjects").innerHTML=projects.slice(0,4).map(card).join("")||empty("Você ainda não possui projetos.");
  $("allProjects").innerHTML=mine.map(card).join("")||empty("Você ainda não criou nenhum projeto.");
  $("sharedProjects").innerHTML=shared.map(card).join("")||empty("Nenhum projeto foi compartilhado com você.");
  $("sharedBadge").hidden=!shared.length;$("sharedBadge").textContent=shared.length;
  bindProjectCards();renderPurchases();
}
function bindProjectCards(){document.querySelectorAll(".project-card").forEach(el=>el.onclick=()=>openProject(Number(el.dataset.projectId)))}
function showView(name){
  ["home","projects","shared","purchases","alerts","project","account"].forEach(x=>$(x+"View").hidden=x!==name);
  document.querySelectorAll(".nav[data-view]").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
  $("pageTitle").textContent={home:"Visão geral",projects:"Meus projetos",shared:"Compartilhados",purchases:"Compras",alerts:"Alertas de preço",project:"Projeto",account:"Minha conta"}[name]||"CompraKi";
}
async function openProject(id){
  currentProject=projects.find(p=>Number(p.id)===Number(id));
  if(!currentProject)return toast("Projeto não encontrado.");
  $("projectName").textContent=currentProject.name;$("projectTemplate").textContent=currentProject.template||"Projeto";
  $("projectAccess").innerHTML=`<span class="role-badge ${isOwner()?"owner":""}">${roleLabel(currentProject.my_role)}</span><small class="muted">Projeto #${currentProject.id}</small>`;
  $("deleteProjectBtn").hidden=!isOwner();$("membersBtn").hidden=false;$("newItemBtn").hidden=!canEdit();$("readonlyNote").hidden=canEdit();
  showView("project");await loadItems();
}
async function loadItems(){try{items=await api("/api/items/project/"+currentProject.id);renderItems()}catch(e){toast(e.message)}}
function renderItems(){
  const q=$("itemSearch").value.toLowerCase(),f=$("statusFilter").value,list=items.filter(x=>(!f||x.status===f)&&(!q||(x.name||"").toLowerCase().includes(q)||(x.store||"").toLowerCase().includes(q)));
  const planned=items.filter(x=>x.status!=="CANCELADO").reduce((a,x)=>a+(Number(x.found_price)||Number(x.planned_price)||0)*Number(x.quantity||1),0),spent=items.filter(x=>x.status==="COMPRADO").reduce((a,x)=>a+Number(x.paid_price||0)*Number(x.quantity||1),0),budget=Number(currentProject.budget||0);
  $("projectStats").innerHTML=stat("Orçamento",brl(budget))+stat("Planejado",brl(planned))+stat("Comprado",brl(spent))+stat("Livre para planejar",brl(budget-planned));
  $("itemsGrid").innerHTML=list.map(productCard).join("")||empty(items.length?"Nenhum item corresponde ao filtro.":"Adicione o primeiro produto deste projeto.");
  document.querySelectorAll("[data-edit-item]").forEach(b=>b.onclick=()=>editItem(Number(b.dataset.editItem)));
}
function productCard(x){const price=x.status==="COMPRADO"?x.paid_price:(x.found_price||x.planned_price),url=x.product_url&&/^https?:\/\//i.test(x.product_url)?x.product_url:"";return `<article class="product-card"><div class="product-img">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.name)}">`:"<span style='font-size:42px'>🛍️</span>"}</div><div class="product-body"><div><span class="tag">${labelStatus(x.status)}</span></div><h3>${esc(x.name)}</h3><div class="product-store">${esc(x.store||"Loja não informada")} • Qtd. ${x.quantity||1}</div><div class="product-price">${brl(price)}</div><div class="product-actions">${url?`<a class="shop-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir na loja ↗</a>`:""}${canEdit()?`<button data-edit-item="${x.id}" class="edit-placeholder" type="button">Editar</button>`:""}</div></div></article>`}
function labelStatus(s){return {A_ESCOLHER:"A escolher",ESCOLHIDO:"Escolhido",COMPRADO:"Comprado",CANCELADO:"Cancelado"}[s]||s}

function newProject(){$("projectForm").reset();$("projectDlg").showModal()}
async function createProject(e){e.preventDefault();try{await api("/api/projects",{method:"POST",body:JSON.stringify({name:$("pname").value,template:$("ptemplate").value,budget:$("pbudget").value})});$("projectDlg").close();toast("Projeto criado.");await loadProjects()}catch(e){toast(e.message)}}

function resetItemForm(){$("itemForm").reset();$("iqty").value=1;$("iinstallments").value=1;$("preview").innerHTML="";$("importStatus").textContent="";$("editItemId").value="";imported={};togglePurchase()}
function newItem(){
  if(!currentProject||!canEdit())return toast("Você não tem permissão para adicionar itens.");
  resetItemForm();
  // CORREÇÃO CRÍTICA: o projeto é congelado no momento em que o modal abre.
  $("itemProjectId").value=String(currentProject.id);
  $("itemDialogEyebrow").textContent="NOVO PRODUTO";$("itemDialogTitle").textContent=`Adicionar em: ${currentProject.name}`;$("deleteItemBtn").hidden=true;
  $("itemDlg").showModal();
}
async function importUrl(){
  const url=$("url").value.trim();if(!url)return toast("Cole o link do produto.");
  $("importStatus").textContent="Buscando dados do produto...";$("importBtn").disabled=true;
  try{
    imported=await api("/api/items/import-url",{method:"POST",body:JSON.stringify({url})});
    if(imported.name)$("iname").value=imported.name;if(imported.description)$("idesc").value=imported.description;if(imported.price)$("ifound").value=imported.price;if(imported.store)$("istore").value=imported.store;
    if(imported.price)$("istatus").value="ESCOLHIDO";
    $("preview").innerHTML=`<div class="preview-card">${imported.image?`<img src="${esc(imported.image)}">`:""}<div><b>${esc(imported.name||"Link registrado")}</b><br><small>${imported.price?brl(imported.price):"Preço não identificado. O link será salvo mesmo assim."}</small></div></div>`;
    $("importStatus").textContent=imported.partial||imported.warning?"Link preservado. Complete os dados que a loja não permitiu ler.":"Dados encontrados. Confira antes de salvar.";
  }catch(e){$("importStatus").textContent="O link continua no formulário. Preencha os dados manualmente.";toast(e.message)}
  finally{$("importBtn").disabled=false;togglePurchase()}
}
function togglePurchase(){$("purchaseFields").hidden=$("istatus").value!=="COMPRADO"}
function editItem(id){
  const x=items.find(i=>Number(i.id)===Number(id));if(!x||!canEdit())return;
  resetItemForm();$("itemProjectId").value=String(x.project_id);$("editItemId").value=String(x.id);
  $("itemDialogEyebrow").textContent="EDITAR PRODUTO";$("itemDialogTitle").textContent=`${currentProject.name}`;
  $("url").value=x.product_url||"";$("iname").value=x.name||"";$("idesc").value=x.description||"";$("iqty").value=x.quantity||1;$("iplanned").value=x.planned_price||"";$("ifound").value=x.found_price||"";$("istore").value=x.store||"";$("istatus").value=x.status||"A_ESCOLHER";$("ipaid").value=x.paid_price||"";$("idate").value=x.purchased_at?String(x.purchased_at).slice(0,10):"";$("ipay").value=x.payment_method||"";$("iinstallments").value=x.installments||1;imported.image=x.image_url||"";
  $("deleteItemBtn").hidden=false;togglePurchase();$("itemDlg").showModal();
}
async function saveItem(e){
  e.preventDefault();
  try{
    const projectId=Number($("itemProjectId").value),editId=Number($("editItemId").value||0);
    if(!currentProject||projectId!==Number(currentProject.id))throw Error("Projeto do item não corresponde ao projeto aberto. Feche e abra novamente.");
    const st=$("istatus").value,d={project_id:projectId,name:$("iname").value,description:$("idesc").value,quantity:$("iqty").value,planned_price:$("iplanned").value,found_price:$("ifound").value,paid_price:$("ipaid").value,status:st,store:$("istore").value,product_url:$("url").value.trim(),image_url:imported.image||"",purchased_at:$("idate").value||null,payment_status:st==="COMPRADO"?"PENDENTE":"NAO_SE_APLICA",payment_method:$("ipay").value,installments:$("iinstallments").value};
    await api(editId?"/api/items/"+editId:"/api/items",{method:editId?"PUT":"POST",body:JSON.stringify(d)});
    $("itemDlg").close();toast(editId?"Produto atualizado.":"Produto adicionado ao projeto correto.");await loadItems();await loadProjects();currentProject=projects.find(p=>Number(p.id)===projectId)||currentProject;
  }catch(e){toast(e.message)}
}
async function deleteItem(){
  const id=Number($("editItemId").value||0);if(!id||!confirm("Excluir este produto?"))return;
  try{await api("/api/items/"+id,{method:"DELETE"});$("itemDlg").close();toast("Produto excluído.");await loadItems();await loadProjects()}catch(e){toast(e.message)}
}

async function openMembers(){
  if(!currentProject)return;
  $("membersDlg").showModal();await loadMembers();
}
async function loadMembers(){
  try{
    const d=await api(`/api/projects/${currentProject.id}/members`);
    $("memberInvite").hidden=d.my_role!=="OWNER";
    $("memberList").innerHTML=d.members.map(m=>`<div class="member-row"><div><b>${esc(m.name)}</b><small>${esc(m.email)}</small></div>${m.role==="OWNER"?`<span class="role-badge owner">Dono</span>`:`<select data-member-role="${m.id}" ${!isOwner()?"disabled":""}><option value="VIEWER" ${m.role==="VIEWER"?"selected":""}>Visualizador</option><option value="EDITOR" ${m.role==="EDITOR"?"selected":""}>Editor</option></select>`}${m.role!=="OWNER"&&isOwner()?`<button class="icon-btn danger-mini" data-remove-member="${m.id}" type="button">Remover</button>`:""}</div>`).join("");
    document.querySelectorAll("[data-member-role]").forEach(s=>s.onchange=()=>changeMemberRole(s.dataset.memberRole,s.value));
    document.querySelectorAll("[data-remove-member]").forEach(b=>b.onclick=()=>removeMember(b.dataset.removeMember));
  }catch(e){toast(e.message)}
}
async function addMember(){try{await api(`/api/projects/${currentProject.id}/members`,{method:"POST",body:JSON.stringify({email:$("memberEmail").value,role:$("memberRole").value})});$("memberEmail").value="";toast("Acesso atualizado.");await loadMembers();await loadProjects()}catch(e){toast(e.message)}}
async function changeMemberRole(userId,role){try{await api(`/api/projects/${currentProject.id}/members/${userId}`,{method:"PATCH",body:JSON.stringify({role})});toast("Permissão atualizada.")}catch(e){toast(e.message);await loadMembers()}}
async function removeMember(userId){if(!confirm("Remover este participante do projeto?"))return;try{await api(`/api/projects/${currentProject.id}/members/${userId}`,{method:"DELETE"});toast("Participante removido.");await loadMembers();await loadProjects()}catch(e){toast(e.message)}}

function askDeleteProject(){if(!isOwner())return toast("Somente o dono pode excluir o projeto.");$("confirmText").textContent=`O projeto "${currentProject.name}" e todos os produtos dele serão excluídos. Esta ação não pode ser desfeita.`;$("confirmDlg").showModal()}
async function deleteProject(){if(!currentProject||!isOwner())return;const id=currentProject.id;$("confirmDeleteBtn").disabled=true;try{await api("/api/projects/"+id,{method:"DELETE"});$("confirmDlg").close();currentProject=null;await loadProjects();showView("projects");toast("Projeto excluído.")}catch(e){toast(e.message)}finally{$("confirmDeleteBtn").disabled=false}}

async function renderPurchases(){
  const bought=[];
  for(const p of projects){
    // evita várias chamadas no boot; só usa itens do projeto atualmente carregado quando disponível
    if(currentProject&&Number(currentProject.id)===Number(p.id))items.filter(i=>i.status==="COMPRADO").forEach(i=>bought.push({...i,_project:p.name}));
  }
  $("purchasesGrid").innerHTML=bought.length?bought.map(x=>productCard(x)).join(""):empty("Abra seus projetos para acompanhar as compras. A visão consolidada completa entra na próxima evolução.");
}

function setupPWA(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/service-worker.js").catch(()=>{});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").classList.add("ready")});
  $("installBtn").onclick=async()=>{if(!deferredInstall)return toast("Use a opção 'Instalar aplicativo' do navegador.");deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").classList.remove("ready")};
}

document.addEventListener("DOMContentLoaded",()=>{
  $("loginBtn").onclick=login;$("registerSubmitBtn").onclick=register;$("registerBtn").onclick=()=>setAuthMode("register");$("backToLoginBtn").onclick=()=>setAuthMode("login");$("togglePassword").onclick=togglePasswordVisibility;$("logoutBtn").onclick=logout;setAuthMode("login");
  document.querySelectorAll(".new-project").forEach(b=>b.onclick=newProject);
  document.querySelector(".close-project").onclick=()=>$("projectDlg").close();document.querySelector(".close-item").onclick=()=>$("itemDlg").close();document.querySelector(".close-members").onclick=()=>$("membersDlg").close();
  $("projectForm").onsubmit=createProject;$("itemForm").onsubmit=saveItem;$("importBtn").onclick=importUrl;$("istatus").onchange=togglePurchase;$("deleteItemBtn").onclick=deleteItem;
  $("newItemBtn").onclick=newItem;$("membersBtn").onclick=openMembers;$("addMemberBtn").onclick=addMember;
  $("deleteProjectBtn").onclick=askDeleteProject;$("cancelDeleteBtn").onclick=()=>$("confirmDlg").close();$("confirmDeleteBtn").onclick=deleteProject;
  $("backBtn").onclick=()=>{
    currentProject=null;
    items=[];
    showView("projects");
    loadProjects();
  };
  $("itemSearch").oninput=renderItems;
  $("statusFilter").onchange=renderItems;
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
  setupPWA();boot();
});
