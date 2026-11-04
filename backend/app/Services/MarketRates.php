<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Taxas de mercado do Banco Central (API SGS).
 *  - CDI anualizado (base 252): série 4389
 *  - Selic meta:                série 432
 *  - IPCA acumulado 12 meses:   série 13522
 *
 * Leitura boa fica 12h em cache. Se a API estiver fora, usa a última leitura boa
 * (ou os valores de config/services.php) e tenta de novo em 30 minutos.
 */
class MarketRates
{
    private const SERIES = ['cdi' => 4389, 'selic' => 432, 'ipca' => 13522];

    /** @return array{cdi: float, selic: float, ipca: float, date: ?string, source: string} */
    public function all(): array
    {
        if ($cached = Cache::get('market-rates')) {
            return $cached;
        }

        try {
            $out = ['date' => null, 'source' => 'bcb'];
            foreach (self::SERIES as $key => $code) {
                $res = Http::timeout(6)->retry(2, 300)->acceptJson()
                    ->get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.{$code}/dados/ultimos/1", ['formato' => 'json'])
                    ->throw()->json();
                $last = end($res);
                $out[$key] = (float) str_replace(',', '.', $last['valor']);
                if ($key === 'cdi') {
                    $out['date'] = Carbon::createFromFormat('d/m/Y', $last['data'])->toDateString();
                }
            }
            Cache::put('market-rates', $out, now()->addHours(12));
            Cache::forever('market-rates:last-good', $out);

            return $out;
        } catch (Throwable $e) {
            report($e);
            $fallback = Cache::get('market-rates:last-good') ?? [
                'cdi' => (float) config('services.market.cdi'),
                'selic' => (float) config('services.market.selic'),
                'ipca' => (float) config('services.market.ipca'),
                'date' => null,
            ];
            $fallback['source'] = 'fallback';
            Cache::put('market-rates', $fallback, now()->addMinutes(30));

            return $fallback;
        }
    }

    public function cdi(): float
    {
        return $this->all()['cdi'];
    }

    public function ipca(): float
    {
        return $this->all()['ipca'];
    }
}
