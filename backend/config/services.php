<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Web Push. Gere as chaves com `php artisan push:vapid`.
    // subject: e-mail (mailto:) ou URL https de contato do responsável pelo sistema.
    'webpush' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:contato@planilha.app'),
    ],

    // App Android (TWA): ver rota /.well-known/assetlinks.json em routes/web.php.
    'twa' => [
        'package' => env('TWA_PACKAGE_NAME'),
        'fingerprints' => env('TWA_SHA256_FINGERPRINTS'),
    ],

    // Taxas usadas só se a API do Banco Central estiver fora do ar (% ao ano).
    'market' => [
        'cdi' => env('MARKET_CDI_FALLBACK', 13.65),
        'selic' => env('MARKET_SELIC_FALLBACK', 13.75),
        'ipca' => env('MARKET_IPCA_FALLBACK', 4.5),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
