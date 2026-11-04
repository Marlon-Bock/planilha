import { AlertTriangle, Check, Clock } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { Badge } from "@/components/ui";

export function StatusBadge({ t }: { t: Pick<Transaction, "status" | "type"> }) {
  if (t.status === "paid") return <Badge tone="green"><Check className="h-3 w-3" />{t.type === "income" ? "Recebido" : "Pago"}</Badge>;
  if (t.status === "overdue") return <Badge tone="red"><AlertTriangle className="h-3 w-3" />Vencido</Badge>;
  return <Badge tone="amber"><Clock className="h-3 w-3" />Pendente</Badge>;
}
