<?php

namespace App\Notifications\Channels;

use App\Services\WebPushService;
use Illuminate\Notifications\Notification;

/** Canal de notificação Laravel → Web Push. A notificação precisa ter toWebPush(). */
class WebPushChannel
{
    public function __construct(private WebPushService $push) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (method_exists($notification, 'toWebPush')) {
            $this->push->sendToUser($notifiable, $notification->toWebPush($notifiable));
        }
    }
}
