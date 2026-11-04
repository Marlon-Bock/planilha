<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Tag::withCount('transactions')->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Tag::create($this->validated($request))], 201);
    }

    public function update(Request $request, Tag $tag): JsonResponse
    {
        $tag->update($this->validated($request, $tag));

        return response()->json(['data' => $tag]);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $tag->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, ?Tag $tag = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:40',
                Rule::unique('tags')->where('user_id', $request->user()->id)->ignore($tag?->id)],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
    }
}
