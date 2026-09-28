# CompraKi V2

SaaS de planejamento inteligente de compras.

## Rodar
1. Instale Node.js 20+ e PostgreSQL.
2. Crie o banco `compraki`.
3. Copie `.env.example` para `.env` e configure DATABASE_URL e JWT_SECRET.
4. Execute `npm install`.
5. Execute `npm run db:init`.
6. Execute `npm start`.
7. Abra http://localhost:3000.

## Já incluído
- Cadastro/login com senha criptografada e JWT
- Estrutura de assinatura no banco
- Projetos e orçamento
- Produtos A escolher / Escolhido / Comprado / Cancelado
- Importação de URL por JSON-LD/OpenGraph quando a loja permitir
- Imagem, descrição, loja e preço
- Histórico de preço inicial
- Dashboard por projeto
- Estrutura de projetos compartilhados
- PWA manifest e layout responsivo

## Próxima camada de produção
Gateway de assinatura mensal + webhooks, recuperação de senha/e-mail, login Google, service worker completo, push notifications, edição de itens, membros/convites e job periódico de preços.
