export type TxType = "income" | "expense" | "transfer";
export type TxStatus = "paid" | "pending" | "overdue";

export interface User {
  id: number;
  name: string;
  partner_name: string | null;
  together_since: string | null;
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

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string;
  notes: string | null;
  completed_at: string | null;
  progress: number;
  monthly_needed: number | null;
  contributions?: { id: number; amount: number; date: string; note: string | null }[];
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
