require("dotenv").config();
const express=require("express"),cors=require("cors"),path=require("path"),fs=require("fs"),db=require("./db");
const app=express();
app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use("/api/auth",require("./routes/auth"));
app.use("/api/projects",require("./routes/projects"));
app.use("/api/items",require("./routes/items"));
app.use(express.static(path.join(__dirname,"../public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"../public/index.html")));

const PORT=process.env.PORT||3000;
(async()=>{
  try{
    const schema=fs.readFileSync(path.join(__dirname,"../sql/schema.sql"),"utf8");
    await db.query(schema);
    app.listen(PORT,"0.0.0.0",()=>console.log(`CompraKi rodando na porta ${PORT}`));
  }catch(e){
    console.error("Falha ao inicializar banco/servidor:",e);
    process.exit(1);
  }
})();
