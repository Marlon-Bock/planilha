# Planilha Financeira

SaaS de controle financeiro pessoal, multiusuário.

- **`backend/`**: API REST em Laravel 13 + Sanctum (sessão via cookie httpOnly + CSRF)
- **`frontend/`**: Next.js 16 (App Router) + Tailwind CSS 4 + React Query + Recharts

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Login / cadastro** | Cada usuário vê só os próprios dados (isolamento automático no backend). O primeiro cadastro vira administrador. Quem se cadastra já recebe 16 categorias padrão e uma carteira. |
| **Dashboard** | Saldo das contas, receitas/despesas do mês com variação em relação ao mês anterior, taxa de economia, gráfico de 12 meses, fluxo diário acumulado, gastos por categoria, contas a pagar, orçamentos, metas e alerta de contas vencidas. |
| **Lançamentos** (a "planilha") | Receitas, despesas e transferências. Parcelamento (valor total dividido ou valor por parcela), tags, forma de pagamento e observações. Filtros por mês, período, status (pago / a vencer / vencido), contas, categorias, tags, forma de pagamento, faixa de valor e busca. Ordenação, totais do filtro, ações em massa (pagar, mudar categoria, excluir), duplicar e **exportar CSV** (abre direto no Excel). |
| **Contas e cartões** | Conta corrente, poupança, dinheiro, investimento e cartão de crédito (limite, dia de fechamento e de vencimento). Saldo atual e saldo previsto. Contas podem ser arquivadas. |
| **Categorias e tags** | CRUD com cor e ícone. Ao excluir uma categoria, dá para mover os lançamentos dela para outra. |
| **Orçamentos** | Limite mensal por categoria, com progresso e opção de copiar os limites do mês anterior. |
| **Metas** | Valor objetivo, prazo, depósitos e retiradas com histórico, e quanto é preciso guardar por mês. |
| **Recorrentes** | Contas fixas e salário (semanal, mensal ou anual). Os lançamentos são gerados automaticamente, com baixa automática opcional. |
| **Relatórios** | Qualquer período: categorias, contas, forma de pagamento, tags, maiores despesas, tabela mensal e médias. |
| **Avisos** | Conta a vencer (a antecedência é configurável no perfil), conta vencida, orçamento em 80% e em 100%, meta atingida e saldo negativo. Sino com contador no topo da tela. |
| **Admin** | Lista de usuários com estatísticas. Permite criar, ativar/desativar, promover e excluir usuários. |
| **Perfil** | Dados pessoais, moeda, troca de senha e exclusão da conta. Tema claro/escuro. |

## Rodando localmente

Requisitos: PHP 8.3+ (no Herd: `php84`), Composer e Node 20+.

```bash
# 1) Backend
cd backend
composer install
cp .env.example .env            # configure DB_* (MySQL) — senha com # ou $ precisa de aspas: DB_PASSWORD='...'
php artisan key:generate
php artisan migrate --seed      # --seed cria usuários e 6 meses de dados de demonstração
php artisan serve --port=8000

# 2) Frontend (outro terminal)
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

O Next repassa `/api/*` e `/sanctum/*` para o Laravel (`BACKEND_URL`, padrão `http://127.0.0.1:8000`). Assim o navegador fala com uma única origem.

**Usuários de demonstração** (criados pelo `--seed`):
- `admin@planilha.test` / `senha123` (administrador)
- `demo@planilha.test` / `senha123` (já com dados)

> ⚠️ Troque essas senhas, ou não rode o seed, em qualquer banco acessível pela internet.

### Rotinas agendadas

```bash
php artisan schedule:work               # em dev
# em produção, no cron: * * * * * php /caminho/backend/artisan schedule:run
```

- `finance:generate-recurring` (diário, 00:10): gera os lançamentos recorrentes até o fim do próximo mês.
- `finance:check-alerts` (diário, 07:00): cria os avisos.

As duas também podem ser disparadas pela interface ("Gerar lançamentos" e "Verificar agora").

### Notificações push (app fechado)

Os avisos (contas a vencer/vencidas, orçamento, metas, saldo negativo) também chegam como notificação
no celular/PC, inclusive com o app fechado. Cada pessoa ativa em **Perfil → Notificações no celular e no PC**.

- Funciona no Chrome/Edge/Firefox (PC e Android, inclusive no APK/TWA) e no iPhone com iOS 16.4+
  **com o app adicionado à tela de início**. Exige **HTTPS** (no PC, `localhost` também serve).
- Chaves do servidor: `php artisan push:vapid` → copie para o `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT=mailto:seu-email`). Trocar as chaves obriga cada aparelho a ativar de novo.
- Os avisos são gerados pela rotina diária (`finance:check-alerts`, 07:00): o **agendador precisa estar rodando**
  (`schedule:work` em dev ou o cron em produção).
- **Windows (só em dev):** o PHP precisa da variável `OPENSSL_CONF` apontando para o `openssl.cnf`
  (no Herd: `%USERPROFILE%\.config\herd\bin\php84\extras\ssl\openssl.cnf`) ao rodar `artisan serve`
  e `schedule:work`; sem ela, a criptografia das notificações falha. Em servidor Linux não é necessário.

## Testes

```bash
cd backend && php artisan test   # usa SQLite em memória; não toca no banco real
```

## Produção (resumo)

- Backend: `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `SANCTUM_STATEFUL_DOMAINS=seudominio.com`, `FRONTEND_URL=https://seudominio.com`
- Frontend: `BACKEND_URL=https://api.seudominio.com`, depois `npm run build && npm start`
