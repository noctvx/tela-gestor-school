# SchoolFix

O SchoolFix é um painel para alunos registrarem reclamações e sugestões, e para a equipe da instituição acompanhar esses registros.

## Como o sistema funciona

O projeto tem duas formas de uso:

- **Demonstração local:** abre os arquivos diretamente no navegador. Não precisa de banco de dados. Os registros de teste ficam salvos naquele navegador.
- **Sistema real:** usa um servidor Node.js e um banco MySQL. As contas, reclamações e sugestões são salvas no banco. Esta forma exige a instalação e a configuração descritas abaixo.

Quando o sistema real está configurado, o fluxo é:

1. A pessoa entra com seu RA e sua senha.
2. O servidor confere os dados no banco e mantém a sessão de acesso.
3. O aluno envia uma reclamação ou sugestão pelo painel.
4. O servidor grava o registro e associa-o à conta do aluno.
5. O aluno vê seus próprios registros; professores e administradores podem ver os registros da comunidade.

**Importante:** os logins de demonstração não são contas reais. Eles não acessam o banco nem enviam dados para a instituição.

## Requisitos

- Node.js 20 ou superior.
- MySQL 8 ou superior.
- Um servidor SMTP para habilitar a recuperação de senha por e-mail.

## Instalação do sistema real

1. Instale as dependências:

   ```powershell
   npm install
   ```

2. Crie o banco e as tabelas:

   ```powershell
   cmd /c "mysql -u root -p < db\schema.sql"
   ```

   Esse comando importa `db/schema.sql`. O arquivo cria o banco `schoolfix` e as tabelas usadas pelo sistema.

   Depois, crie um usuário próprio para a aplicação. A tabela de sessões será criada automaticamente ao iniciar o servidor:

   ```sql
   CREATE USER 'schoolfix'@'localhost' IDENTIFIED BY 'substitua-por-uma-senha-forte';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON schoolfix.* TO 'schoolfix'@'localhost';
   ```

3. Configure as variáveis de ambiente:

   ```powershell
   Copy-Item .\.env.example .\.env
   ```

   O arquivo `.env` guarda as configurações locais do servidor. Gere o `SESSION_SECRET` com `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` e preencha também os dados do MySQL. O SMTP é opcional e só é necessário para recuperação de senha por e-mail. Não use o usuário `root` do MySQL na aplicação.

4. Cadastre o primeiro administrador:

   ```powershell
   npm run create-admin
   ```

   O comando pede os dados da primeira conta de administrador. Não existe cadastro público. Depois de entrar, o administrador pode cadastrar contas de alunos, professores e outros administradores na seção **Configurações**.

5. Inicie o servidor:

   ```powershell
   npm start
   ```

6. Abra `http://localhost:3000` no navegador e entre com o RA e a senha cadastrados.

Durante o desenvolvimento, `npm run dev` reinicia o servidor quando os arquivos do backend mudam. `npm run check` verifica a sintaxe dos arquivos JavaScript.

## Demonstração simples, sem banco de dados

Para experimentar o painel sem instalar o MySQL:

1. Abra o arquivo `login.html` no navegador.
2. Entre com um destes RAs e a senha `1234`:
   - Aluno: `ALU2026001`
   - Gestor: `GES2026001`
3. Como aluno, crie uma reclamação ou sugestão.
4. Volte à tela de login, entre como gestor e abra **Todas as reclamações**. Os registros enviados pelo aluno também aparecem na lista de sugestões dessa tela.

Na demonstração, os registros ficam no armazenamento local do navegador e podem ser vistos pelos dois perfis **nesse mesmo navegador e computador**. Eles não vão para o MySQL, não são enviados à UNISAL e não aparecem em outros dispositivos. O gestor também pode alterar o status e responder às reclamações de teste.

## Recuperação de senha

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` no `.env`. O link de redefinição é aleatório, armazenado somente como hash e expira após 30 minutos. Sem SMTP, a tela informa que a recuperação não está disponível e orienta o usuário a contatar a administração.

## Segurança no sistema real

- As senhas ficam protegidas por hash bcrypt; o servidor nunca precisa guardar a senha em texto puro.
- Cada RA identifica uma única conta.
- A sessão mantém o usuário conectado. As páginas privadas e o cadastro de contas são controlados pelo servidor.
- O servidor verifica os dados recebidos antes de gravá-los.
- Para publicar o sistema, use HTTPS e mantenha o `.env` privado.
- Não há integração com o portal ou as senhas da UNISAL. O RA é comparado apenas com as contas cadastradas no SchoolFix.

## Para que serve cada arquivo principal

- `login.html`: desenho da tela de entrada.
- `login.js`: confere o formulário e envia o login ao servidor; também contém os logins fictícios da demonstração local.
- `index.html`: estrutura das páginas do painel, como reclamações, sugestões e configurações.
- `script.js`: controla as ações e atualiza o painel. Na demonstração, também lê e grava registros no navegador.
- `style.css`: cores, fontes, espaçamento e adaptação do site para telas menores.
- `server.js`: aplicação Node.js/Express. Confere a sessão e as permissões, recebe reclamações e sugestões e consulta ou grava dados no MySQL.
- `db/schema.sql`: instruções para criar o banco e as tabelas.
- `scripts/create-admin.js`: ferramenta para criar o primeiro administrador.
- `.env.example`: lista das configurações necessárias. Copie para `.env` e preencha com os dados do seu ambiente.
- `package.json`: lista os pacotes usados e os comandos, como `npm start` e `npm run check`.

No sistema real, reclamações, respostas, sugestões, avaliações e mensagens dos canais são gravadas no MySQL e associadas à conta que as enviou. O aluno acompanha os próprios registros; professores e administradores podem acompanhar os registros da comunidade. Mensagens diretas e algumas preferências permanecem salvas somente no navegador e ainda não são sincronizadas entre dispositivos.
