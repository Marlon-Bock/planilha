<?php

namespace App\Notifications;

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
        return ['database'];
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
