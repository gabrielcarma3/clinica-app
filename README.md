# Clínica — Gestão para Psicólogos e Terapeutas

App web responsivo (futuramente mobile) para gestão de agenda, pacientes e financeiro de profissionais de saúde mental.

---

## Stack

- **Frontend**: HTML + CSS + JavaScript puro (sem framework — roda em qualquer lugar)
- **Build**: Vite (desenvolvimento e build)
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Netlify, Vercel, ou qualquer hospedagem estática

---

## Funcionalidades

### Autenticação
- Login e cadastro com e-mail/senha
- Sessão persistente (refresh token automático)
- Dados isolados por profissional (Row Level Security)

### Agenda
- Visualização semanal com grid de 6 dias
- Pacientes aparecem automaticamente no dia/horário cadastrado
- Suporte a frequência semanal, quinzenal e mensal
- Status de sessão: Agendada / Realizada / Falta s/ aviso / Falta c/ aviso / Cancelada
- Sessões avulsas (fora do horário fixo)
- Resumo do dia com total previsto

### Pacientes
- Cadastro completo: nome, WhatsApp, e-mail, dia, horário, valor, frequência
- Flag de preço social
- Observações internas
- Histórico de sessões com status e pagamentos
- Saldo total, recebido e pendente por paciente
- Arquivamento

### Financeiro
- Resumo mensal: faturado × recebido × pendente
- Barra de progresso de recebimento
- Lista de inadimplência com "marcar pago" rápido
- Tabela detalhada por paciente
- Navegação por mês

---

## Configuração Supabase (5 minutos)

### 1. Criar projeto
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em "New project" e preencha as informações
3. Aguarde a criação (1-2 minutos)

### 2. Criar tabelas
1. No painel do Supabase, clique em **SQL Editor**
2. Copie o SQL comentado dentro do arquivo `src/lib/supabase.js`
3. Cole e execute (botão "Run")

### 3. Configurar o app
1. No Supabase, vá em **Settings → API**
2. Copie:
   - **Project URL** → cole em `SUPABASE_URL` no arquivo `src/lib/supabase.js`
   - **anon/public key** → cole em `SUPABASE_ANON_KEY`

### 4. Rodar localmente
```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

---

## Deploy (Netlify — gratuito)

```bash
npm run build
```

1. Acesse [netlify.com](https://netlify.com)
2. Arraste a pasta `dist/` para o painel de deploy
3. Pronto! URL gerada automaticamente.

Ou conecte ao GitHub para deploy automático a cada push.

---

## Roadmap para App Mobile (próximas etapas)

### Fase 1 — PWA (Progressive Web App)
Transforma o web app em instalável no celular (sem App Store):
- Adicionar `manifest.json` e service worker
- Notificações push nativas

### Fase 2 — React Native / Expo
Para publicar nas lojas (App Store + Google Play):
- Migrar UI para React Native com Expo
- Mesma lógica de negócio e Supabase
- Build com `expo build` para ambas as plataformas

### Fase 3 — SaaS
- Sistema de assinaturas (Stripe)
- Dashboard administrativo
- Suporte a múltiplos profissionais por clínica
- Integração com WhatsApp para lembretes
- Cobranças automáticas via Pix (Asaas/Pagar.me)

---

## Estrutura do Projeto

```
clinica-app/
├── index.html              # Entry point
├── main.js                 # Router principal
├── package.json
├── vite.config.js
└── src/
    ├── styles.css          # Design system completo
    ├── lib/
    │   ├── supabase.js     # Cliente Supabase + SQL setup
    │   └── store.js        # Estado global + lógica de negócio
    └── pages/
        ├── auth.js         # Login / cadastro
        ├── onboarding.js   # Setup inicial
        ├── agenda.js       # Agenda semanal
        ├── patients.js     # Lista + detalhe de pacientes
        └── financial.js    # Resumo financeiro
```

---

## Segurança e LGPD

- **Row Level Security**: cada profissional acessa apenas seus próprios dados
- **HTTPS obrigatório** em produção (Netlify/Vercel proveem automaticamente)
- **Dados no Brasil**: Supabase tem região São Paulo (sa-east-1)
- **Sem compartilhamento**: dados nunca são vendidos ou compartilhados

---

## Licença

Uso livre para desenvolvimento e uso pessoal.
Para distribuição comercial como SaaS, entre em contato.
