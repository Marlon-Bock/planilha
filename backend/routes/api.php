<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\InvestmentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\RecurringTransactionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\PetController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\SharingController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
});

Route::middleware(['auth:sanctum', 'active', 'view-as'])->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::put('profile', [AuthController::class, 'updateProfile']);
    Route::put('profile/password', [AuthController::class, 'updatePassword']);
    Route::delete('profile', [AuthController::class, 'destroyAccount']);
    Route::get('sharing', [SharingController::class, 'index']);
    Route::put('sharing', [SharingController::class, 'update']);
    Route::put('profile/pet', [PetController::class, 'update']);
    Route::post('profile/pet/feed', [PetController::class, 'feed']);
    Route::post('profile/pet/love', [PetController::class, 'love']);
    Route::patch('profile/photos/cover/position', [PhotoController::class, 'position']);
    Route::get('profile/photos/{slot}', [PhotoController::class, 'show'])->whereIn('slot', PhotoController::SLOTS_LIST);
    Route::post('profile/photos/{slot}', [PhotoController::class, 'store'])->whereIn('slot', PhotoController::SLOTS_LIST);
    Route::delete('profile/photos/{slot}', [PhotoController::class, 'destroy'])->whereIn('slot', PhotoController::SLOTS_LIST);

    Route::get('dashboard', DashboardController::class);
    Route::get('reports', ReportController::class);

    Route::apiResource('accounts', AccountController::class);
    Route::apiResource('categories', CategoryController::class)->except('show');
    Route::apiResource('tags', TagController::class)->except('show');

    Route::get('transactions/export', [TransactionController::class, 'export']);
    Route::post('transactions/bulk', [TransactionController::class, 'bulk']);
    Route::patch('transactions/{transaction}/pay', [TransactionController::class, 'togglePaid']);
    Route::post('transactions/{transaction}/duplicate', [TransactionController::class, 'duplicate']);
    Route::apiResource('transactions', TransactionController::class);

    Route::post('recurring/generate', [RecurringTransactionController::class, 'generate']);
    Route::apiResource('recurring', RecurringTransactionController::class)->except('show')
        ->parameters(['recurring' => 'recurring']);

    Route::post('budgets/copy', [BudgetController::class, 'copy']);
    Route::apiResource('budgets', BudgetController::class)->except('show');

    Route::post('goals/{goal}/contribute', [GoalController::class, 'contribute']);
    Route::post('goals/{goal}/toggle', [GoalController::class, 'toggle']);
    Route::put('goals/{goal}/investments', [GoalController::class, 'linkMine']);
    Route::apiResource('goals', GoalController::class)->except('show');

    Route::get('investment-movements', [InvestmentController::class, 'allMovements']);
    Route::get('investments/{investment}/movements', [InvestmentController::class, 'movements']);
    Route::post('investments/{investment}/movements', [InvestmentController::class, 'storeMovement']);
    Route::delete('investments/{investment}/movements/{movement}', [InvestmentController::class, 'destroyMovement']);
    Route::apiResource('investments', InvestmentController::class)->except('show');

    // Web Push (notificações com o app fechado)
    Route::get('push', [PushSubscriptionController::class, 'index']);
    Route::post('push/subscribe', [PushSubscriptionController::class, 'store']);
    Route::delete('push/subscribe', [PushSubscriptionController::class, 'destroy']);
    Route::post('push/test', [PushSubscriptionController::class, 'test'])->middleware('throttle:5,1');

    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('notifications/check', [NotificationController::class, 'check'])->middleware('throttle:6,1');
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('notifications/{id}', [NotificationController::class, 'destroy']);

    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::apiResource('users', AdminUserController::class)->except('show');
    });
});
