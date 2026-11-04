<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $month = $request->input('month', now()->format('Y-m'));
        [$start, $end] = Transaction::monthRange($month);

        $categories = Category::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->input('type')))
            ->when(! $request->boolean('with_archived'), fn ($q) => $q->where('is_archived', false))
            ->withCount('transactions')
            ->withSum(['transactions as month_total' => fn ($q) => $q->whereBetween('date', [$start, $end])], 'amount')
            ->orderBy('type')->orderBy('name')
            ->get()
            ->each(fn ($c) => $c->month_total = round((float) $c->month_total, 2));

        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Category::create($this->validated($request))], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $category->update($this->validated($request, $category));

        return response()->json(['data' => $category]);
    }

    public function destroy(Request $request, Category $category): JsonResponse
    {
        // Opcionalmente move os lançamentos para outra categoria antes de excluir.
        if ($request->filled('move_to')) {
            $target = Category::where('type', $category->type)->findOrFail($request->integer('move_to'));
            Transaction::where('category_id', $category->id)->update(['category_id' => $target->id]);
        }
        $category->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, ?Category $category = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'type' => [$category ? 'sometimes' : 'required', Rule::in(['income', 'expense'])],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'icon' => ['nullable', 'string', 'max:40'],
            'is_archived' => ['boolean'],
        ]);
    }
}
