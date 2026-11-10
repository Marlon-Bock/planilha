export type TxType = "income" | "expense" | "transfer" | "invest" | "redeem";
export type TxStatus = "paid" | "pending" | "overdue";

/** Cachorrinho do usuário (users.pet). `collar`: cor em hex, ou null = sem coleira. */
export interface PetData {
  name: string | null;
  color: "caramel" | "white" | "choco";
  collar: string | null;
  wander: boolean;
  fed_at: string | null;
  love: number;
}

export interface User {
  id: number;
  name: string;
  partner_name: string | null;
  together_since: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position: number | null;
  background_url: string | null;
  pet: PetData | null;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  currency: string;
  alert_days_before: number;
  last_login_at: string | null;
  created_at: string;
  transactions_count?: number;
}

export interface Account {
  id: number;
  name: string;
  type: "checking" | "savings" | "cash" | "credit_card" | "investment" | "other";
  initial_balance: number;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  color: string;
  include_in_total: boolean;
  is_archived: boolean;
  balance: number;
  projected_balance: number;
  credit_used?: number;
  credit_available?: number;
}

export interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  is_archived: boolean;
  transactions_count?: number;
  month_total?: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  transactions_count?: number;
}

export interface Transaction {
  id: number;
  type: TxType;
  description: string;
  amount: number;
  date: string;
  is_paid: boolean;
  paid_at: string | null;
  status: TxStatus;
  payment_method: string | null;
  notes: string | null;
  account_id: number;
  transfer_account_id: number | null;
  category_id: number | null;
  recurring_transaction_id: number | null;
  investment_id?: number | null;
  investment?: { id: number; name: string; color: string } | null;
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
  account?: Pick<Account, "id" | "name" | "color" | "type">;
  transfer_account?: Pick<Account, "id" | "name" | "color"> | null;
  category?: Pick<Category, "id" | "name" | "color" | "icon" | "type"> | null;
  tags?: Tag[];
}

export interface Totals {
  income: number;
  expense: number;
  balance: number;
  income_paid: number;
  expense_paid: number;
  income_pending: number;
  expense_pending: number;
  count: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page?: number; total: number };
}

export interface Budget {
  id: number;
  month: string;
  amount: number;
  category_id: number;
  category: Pick<Category, "id" | "name" | "color" | "icon">;
  spent: number;
  paid: number;
  remaining: number;
  percent: number;
}

/** Pessoa do sistema (só o necessário para mostrar o nome). */
export interface Person { id: number; name: string }

export interface Goal {
  id: number;
  name: string;
  /** money = juntar dinheiro; task = meta de fazer algo (sem valor). */
  kind: "money" | "task";
  /** Falso quando a meta é de outra pessoa e eu só participo (vejo, mas não altero). */
  is_owner: boolean;
  user?: Person;
  members?: Person[];
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string;
  notes: string | null;
  completed_at: string | null;
  progress: number;
  monthly_needed: number | null;
  contributions?: { id: number; amount: number; date: string; note: string | null }[];
  // Caixinhas vinculadas: o "já guardado" é o saldo delas.
  linked_investments?: { id: number; name: string; institution: string | null; color: string; balance: number; is_estimated: boolean }[];
}

export interface Recurring {
  id: number;
  type: "income" | "expense";
  description: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string | null;
  next_date: string;
  payment_method: string | null;
  auto_paid: boolean;
  is_active: boolean;
  notes: string | null;
  account_id: number;
  category_id: number | null;
  account?: Pick<Account, "id" | "name" | "color">;
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  transactions_count?: number;
}

export interface AppNotification {
  id: string;
  key: string;
  kind: string;
  level: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CategorySlice {
  category_id: number | null;
  name: string;
  color: string;
  total: number;
  count: number;
  percent: number;
}

export interface EvolutionPoint {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export type InvestmentType = "caixinha" | "cdb" | "tesouro" | "lci_lca" | "poupanca" | "previdencia" | "acoes" | "fii" | "cripto" | "outro";
export type RateType = "cdi" | "prefixed" | "ipca" | "poupanca" | "variable";

export interface Investment {
  id: number;
  name: string;
  institution: string | null;
  type: InvestmentType;
  rate_type: RateType;
  rate: number | null;
  liquidity: "daily" | "maturity";
  maturity_date: string | null;
  color: string;
  is_active: boolean;
  notes: string | null;
  balance: number;
  invested: number;
  total_deposits: number;
  total_withdrawals: number;
  yield: number;
  yield_percent: number | null;
  month_yield: number;
  daily_yield: number | null;
  projected_month_yield: number | null;
  annual_rate: number | null;
  last_reported_balance: number | null;
  last_reported_at: string | null;
  is_estimated: boolean;
  goal_id: number | null;
  goal: { id: number; name: string } | null;
}

export interface InvestmentMovement {
  id: number;
  investment_id?: number;
  account_id: number | null;
  account?: { id: number; name: string; color: string } | null;
  investment?: { id: number; name: string; institution: string | null; color: string } | null;
  type: "deposit" | "withdraw" | "balance";
  amount: number;
  date: string;
  note: string | null;
  is_opening: boolean;
}

export interface InvestmentSummary {
  balance: number;
  invested: number;
  yield: number;
  yield_percent: number | null;
  month_yield: number;
  daily_yield: number;
  projected_month_yield: number;
  count: number;
}

export interface MarketRates {
  cdi: number;
  selic: number;
  ipca: number;
  date: string | null;
  source: "bcb" | "fallback" | string;
}
