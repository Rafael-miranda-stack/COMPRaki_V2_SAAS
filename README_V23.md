# CompraKi V2.3

## O que foi adicionado
- PWA instalável (manifest, service worker e ícones).
- Projetos separados por `project_id` no formulário e validados também no backend.
- Compartilhamento por e-mail com papéis OWNER, EDITOR e VIEWER.
- Somente OWNER gerencia participantes e exclui o projeto.
- EDITOR pode adicionar, editar e excluir itens.
- VIEWER somente visualiza.
- Edição e exclusão de produtos.
- Importador de URL ampliado; a URL original é preservada mesmo quando a loja bloqueia a leitura.
- Migrações são executadas automaticamente na inicialização do servidor.

## Deploy
1. Preserve seu `.env` local. Ele não está incluído neste pacote por segurança.
2. Substitua os arquivos do projeto por esta versão.
3. `npm install`
4. Teste localmente com `npm start`.
5. Faça commit/push para `main`. O Render fará o deploy.
6. O banco existente é preservado: `schema.sql` usa alterações idempotentes.

## Compartilhamento
A pessoa precisa criar uma conta no CompraKi primeiro. O OWNER abre o projeto > Participantes, informa o e-mail e escolhe Editor ou Visualizador.
