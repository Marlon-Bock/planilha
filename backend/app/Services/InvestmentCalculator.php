<?php

namespace App\Services;

use App\Models\Investment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Calcula saldo, rendimento e projeções dos investimentos.
 *
 * Modelo: a linha do tempo de cada investimento é feita de aportes, resgates e
 * "saldos informados" (o valor que aparece no app do banco). Entre dois eventos,
 * investimentos com taxa (CDI, prefixado, IPCA+, poupança) rendem por dia útil,
 * como no mercado (base 252). Quando chega um saldo informado, ele vale como
 * verdade e corrige a estimativa. Investimentos de renda variável não são
 * estimados: o saldo é o último informado, mais os aportes e resgates depois dele.
 */
class InvestmentCalculator
{
    public function __construct(private MarketRates $rates) {}

    /** Fator de rendimento por dia útil; null = sem taxa (só saldos informados). */
    public function dailyFactor(Investment $i): ?float
    {
        $r = $i->rate;

        return match ($i->rate_type) {
            // Convenção do mercado: (fator diário do CDI - 1) × percentual contratado.
            'cdi' => $r ? 1 + ((1 + $this->rates->cdi() / 100) ** (1 / 252) - 1) * ($r / 100) : null,
            'prefixed' => $r !== null ? (1 + $r / 100) ** (1 / 252) : null,
            'ipca' => ((1 + $this->rates->ipca() / 100) * (1 + ($r ?? 0) / 100)) ** (1 / 252),
            // Poupança com Selic acima de 8,5%: 0,5% ao mês (+TR, desprezível).
            'poupanca' => 1.005 ** (12 / 252),
            default => null,
        };
    }

    /** Taxa efetiva anual (%) equivalente ao fator diário. */
    public function annualRate(Investment $i): ?float
    {
        $f = $this->dailyFactor($i);

        return $f ? round(($f ** 252 - 1) * 100, 2) : null;
    }

    /** Dias úteis (segunda a sexta) no intervalo (de, até]. Feriados não são considerados. */
    public static function businessDays(Carbon $from, Carbon $to): int
    {
        $from = $from->copy()->startOfDay();
        $to = $to->copy()->startOfDay();
        if ($to->lte($from)) {
            return 0;
        }
        $days = (int) round($from->diffInDays($to));
        $weeks = intdiv($days, 7);
        $count = $weeks * 5;
        $d = $from->copy()->addDays($weeks * 7);
        while ($d->lt($to)) {
            $d->addDay();
            if (! $d->isWeekend()) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Ordena por data e, no mesmo dia, na ordem em que foi registrado: um saldo
     * informado vale para aquele momento, e um aporte registrado depois dele soma.
     */
    private function sorted(Collection $movements): Collection
    {
        return $movements->sortBy([
            fn ($a, $b) => $a->date <=> $b->date,
            fn ($a, $b) => $a->id <=> $b->id,
        ])->values();
    }

    /**
     * Percorre a linha do tempo até `$until` e devolve o estado nessa data,
     * incluindo o rendimento atribuído a cada mês (chave Y-m).
     */
    public function walk(Investment $i, Carbon $until): array
    {
        $f = $this->dailyFactor($i);
        $s = ['balance' => 0.0, 'net' => 0.0, 'deposits' => 0.0, 'withdrawals' => 0.0, 'reported' => null, 'reported_at' => null, 'yields' => [], 'count' => 0];
        $cursor = null;
        $until = $until->copy()->startOfDay();

        // Faz o saldo render do cursor até $to, separando o rendimento por mês.
        $grow = function (Carbon $to) use (&$s, &$cursor, $f) {
            if (! $cursor || ! $f || $s['balance'] <= 0) {
                return;
            }
            while ($cursor->lt($to)) {
                $boundary = $cursor->copy()->addDay()->endOfMonth()->startOfDay();
                $segEnd = $boundary->lt($to) ? $boundary : $to->copy();
                $n = self::businessDays($cursor, $segEnd);
                if ($n > 0) {
                    $g = $s['balance'] * ($f ** $n - 1);
                    $s['balance'] += $g;
                    $key = $segEnd->format('Y-m');
                    $s['yields'][$key] = ($s['yields'][$key] ?? 0) + $g;
                }
                $cursor = $segEnd;
            }
        };

        foreach ($this->sorted($i->movements) as $m) {
            if ($m->date->gt($until)) {
                break;
            }
            $grow($m->date->copy()->startOfDay());
            $a = (float) $m->amount;
            switch ($m->type) {
                case 'deposit':
                    $s['balance'] += $a;
                    $s['net'] += $a;
                    $s['deposits'] += $a;
                    break;
                case 'withdraw':
                    $s['balance'] = max(0, $s['balance'] - $a);
                    $s['net'] -= $a;
                    $s['withdrawals'] += $a;
                    break;
                case 'balance':
                    // A diferença entre o informado e o estimado é rendimento (ou correção) daquele mês.
                    if (! $m->is_opening) {
                        $key = $m->date->format('Y-m');
                        $s['yields'][$key] = ($s['yields'][$key] ?? 0) + ($a - $s['balance']);
                    }
                    $s['balance'] = $a;
                    $s['reported'] = $a;
                    $s['reported_at'] = $m->date->toDateString();
                    break;
            }
            $s['count']++;
            $cursor = $m->date->copy()->startOfDay();
        }
        $grow($until);

        return $s;
    }

    /** Dados de um investimento prontos para a API. */
    public function present(Investment $i): array
    {
        $today = today();
        $f = $this->dailyFactor($i);
        $s = $this->walk($i, $today);
        $balance = round($s['balance'], 2);
        $net = round($s['net'], 2);
        $yield = round($balance - $net, 2);

        return [
            ...$i->only(['id', 'name', 'institution', 'type', 'rate_type', 'rate', 'liquidity', 'maturity_date', 'color', 'is_active', 'notes']),
            'balance' => $balance,
            'invested' => $net,
            'total_deposits' => round($s['deposits'], 2),
            'total_withdrawals' => round($s['withdrawals'], 2),
            'yield' => $yield,
            'yield_percent' => $net > 0 ? round($yield / $net * 100, 2) : null,
            'month_yield' => round($s['yields'][$today->format('Y-m')] ?? 0, 2),
            'daily_yield' => $f ? round($balance * ($f - 1), 2) : null,
            'projected_month_yield' => $f ? round($balance * ($f ** 21 - 1), 2) : null,
            'annual_rate' => $this->annualRate($i),
            'last_reported_balance' => $s['reported'],
            'last_reported_at' => $s['reported_at'],
            // Saldo de hoje é estimativa quando tem taxa e o último saldo informado não é de hoje.
            'is_estimated' => $f !== null && $s['count'] > 0 && $s['reported_at'] !== $today->toDateString(),
            'goal_id' => $i->goal_id,
            'goal' => $i->goal_id && $i->relationLoaded('goal') && $i->goal ? ['id' => $i->goal->id, 'name' => $i->goal->name] : null,
        ];
    }

    /** Totais de uma lista já apresentada. */
    public function summarize(Collection $presented): array
    {
        $balance = round($presented->sum('balance'), 2);
        $invested = round($presented->sum('invested'), 2);
        $yield = round($balance - $invested, 2);

        return [
            'balance' => $balance,
            'invested' => $invested,
            'yield' => $yield,
            'yield_percent' => $invested > 0 ? round($yield / $invested * 100, 2) : null,
            'month_yield' => round($presented->sum('month_yield'), 2),
            'daily_yield' => round($presented->sum(fn ($p) => $p['daily_yield'] ?? 0), 2),
            'projected_month_yield' => round($presented->sum(fn ($p) => $p['projected_month_yield'] ?? 0), 2),
            'count' => $presented->count(),
        ];
    }

    /** Evolução mensal (saldo no fim do mês, aportado líquido e rendimento do mês) somando todos. */
    public function evolution(Collection $investments, int $months = 12): array
    {
        $today = today();
        $points = [];
        for ($k = $months - 1; $k >= 0; $k--) {
            $m = $today->copy()->startOfMonth()->subMonthsNoOverflow($k);
            $points[$m->format('Y-m')] = ['month' => $m->format('Y-m'), 'balance' => 0.0, 'invested' => 0.0, 'yield' => 0.0];
        }

        foreach ($investments as $i) {
            $full = $this->walk($i, $today);
            foreach ($points as $key => &$p) {
                $end = Carbon::createFromFormat('Y-m-d', "{$key}-01")->endOfMonth()->startOfDay();
                $s = $this->walk($i, $end->lt($today) ? $end : $today);
                $p['balance'] += $s['balance'];
                $p['invested'] += $s['net'];
                $p['yield'] += $full['yields'][$key] ?? 0;
            }
            unset($p);
        }

        return array_values(array_map(fn ($p) => [
            'month' => $p['month'],
            'balance' => round($p['balance'], 2),
            'invested' => round($p['invested'], 2),
            'yield' => round($p['yield'], 2),
        ], $points));
    }
}
