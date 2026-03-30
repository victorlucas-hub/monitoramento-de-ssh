# Deploy na Nuvem

Este guia mostra como subir o dashboard de monitoramento em um servidor na nuvem (gratuito).

## Opção 1: Render (Recomendado - Gratuito com Web Service)

### Passo 1: Preparar repositório Git
```powershell
cd 'c:\Users\06908949532\Downloads\ssh monitoramento'
git init
git add .
git commit -m "Initial commit"
```

### Passo 2: Colocar no GitHub
1. Crie uma conta em [github.com](https://github.com) (grátis)
2. Crie um repositório público chamado `ssh-monitoramento`
3. Faça push do código:
```powershell
git remote add origin https://github.com/SEU_USER/ssh-monitoramento.git
git branch -M main
git push -u origin main
```

### Passo 3: Deployr no Render
1. Acesse [render.com](https://render.com) (grátis)
2. Clique em "New +" → "Web Service"
3. Selecione seu repositório `ssh-monitoramento`
4. Configure:
   - **Name**: `ssh-monitoramento`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Clique em "Create Web Service"

Em ~2 minutos estará online. Você terá um link como:
```
https://ssh-monitoramento.onrender.com
```

---

## Opção 2: Railway (Gratuito com 5 USD/mês)

1. Acesse [railway.app](https://railway.app) (grátis com cartão)
2. Clique em "Start a New Project"
3. Selecione "Deploy from GitHub"
4. Conecte seu repositório `ssh-monitoramento`
5. Railway detecta Node.js automaticamente
6. Pronto! Tem um link público.

---

## Opção 3: Vercel (Apenas frontend)

Se quiser colocar **apenas o frontend** no Vercel (HTML/CSS/JS) e manter o backend local:

1. Crie uma pasta `web` com `public/*`
2. Faça deploy no Vercel
3. Configure a URL do backend (local ou remoto) no `app.js`

Mas isso não resolve totalmente, pois o backend precisa rodar em algum lugar.

---

## Localmente com Node.js

Antes de fazer deploy, teste localmente:

```powershell
npm install
npm start
```

Acesse `http://localhost:3000`

---

## Importante

- O arquivo `targets.json` é criado/mantido automaticamente
- O servidor roda em qualquer máquina com Node.js instalado
- Na nuvem, o `targets.json` é persistente por sessão (em Render free, é resetado quando a aplicação reinicia)

**Para persistência permanente em produção**, seria necessário usar um banco de dados (MongoDB, PostgreSQL, etc), mas para agora funciona assim.

---

## Resumo Rápido

1. **Git**: `git init` → `git commit` → `git push` para GitHub
2. **Render**: Conecte GitHub repo → "Web Service" → feito
3. **Acesso**: Use o link público fornecido pelo Render

Seu amigo acessa de qualquer lugar do mundo! 🌍
