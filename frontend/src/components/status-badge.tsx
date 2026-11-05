import { AlertTriangle, Check, Clock } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { Badge } from "@/components/ui";
import { tr } from "@/lib/i18n";

export function StatusBadge({ t }: { t: Pick<Transaction, "status" | "type"> }) {
  if (t.status === "paid") return <Badge tone="green"><Check className="h-3 w-3" />{t.type === "income" ? tr("Recebido", "Received") : tr("Pago", "Paid")}</Badge>;
  if (t.status === "overdue") return <Badge tone="red"><AlertTriangle className="h-3 w-3" />{tr("Vencido", "Overdue")}</Badge>;
  return <Badge tone="amber"><Clock className="h-3 w-3" />{tr("Pendente", "Pending")}</Badge>;
}
