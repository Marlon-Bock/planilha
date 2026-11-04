<?php

namespace App\Notifications;

use App\Models\PushSubscription;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Notifications\Notification;

class FinanceAlert extends Notification
{
    /**
     * @param  string  $key  identificador único para não repetir o mesmo aviso
     * @param  string  $kind  bill_due | bill_overdue | budget_warning | budget_exceeded | goal_reached | negative_balance | system
     * @param  string  $level  info | success | warning | danger
     */
    public function __construct(
        public string $key,
        public string $kind,
        public string $level,
        public string $title,
        public string $message,
        public ?string $link = null,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        // Também manda para o celular/PC, se o usuário ativou as notificações em algum aparelho.
        if (PushSubscription::withoutGlobalScopes()->where('user_id', $notifiable->getKey())->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    /** @return array{title: string, body: string, url: string, tag: string} */
    public function toWebPush(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->message,
            'url' => '/avisos', // URL limpa; na tela de avisos tem o "Ver detalhes"
            'tag' => $this->key,
        ];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'key' => $this->key,
            'kind' => $this->kind,
            'level' => $this->level,
            'title' => $this->title,
            'message' => $this->message,
            'link' => $this->link,
        ];
    }
}
