<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Fotos do usuário (perfil, capa do Dashboard e fundo do app).
 * Os arquivos ficam em storage/app/uploads/{id do usuário}/ e só são entregues a ele mesmo.
 */
class PhotoController extends Controller
{
    /** Local da foto => coluna em users. */
    public const SLOTS = ['avatar' => 'avatar_path', 'cover' => 'cover_path', 'background' => 'background_path'];

    public const SLOTS_LIST = ['avatar', 'cover', 'background'];

    public function show(Request $request, string $slot): StreamedResponse
    {
        $path = $request->user()->{self::SLOTS[$slot]};
        abort_unless($path && Storage::disk('uploads')->exists($path), 404);

        // O nome do arquivo muda a cada troca (e a URL leva ?v=), então pode ficar em cache.
        return Storage::disk('uploads')->response($path, null, ['Cache-Control' => 'private, max-age=31536000, immutable']);
    }

    public function store(Request $request, string $slot): JsonResponse
    {
        $request->validate(
            ['photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240']],
            ['photo.max' => 'A foto pode ter no máximo 10 MB.'],
            ['photo' => 'foto'],
        );

        $user = $request->user();
        $file = $request->file('photo');
        $name = $slot.'-'.Str::lower(Str::random(20)).'.'.($file->extension() ?: 'jpg');
        $path = $file->storeAs((string) $user->id, $name, 'uploads');
        abort_unless($path, 500, 'Não foi possível salvar a foto.');

        $column = self::SLOTS[$slot];
        $old = $user->{$column};
        $user->forceFill([$column => $path])->save();
        if ($old && $old !== $path) {
            Storage::disk('uploads')->delete($old);
        }

        return response()->json(['user' => $user->fresh()]);
    }

    public function destroy(Request $request, string $slot): JsonResponse
    {
        $user = $request->user();
        $column = self::SLOTS[$slot];
        if ($user->{$column}) {
            Storage::disk('uploads')->delete($user->{$column});
            $user->forceFill([$column => null])->save();
        }

        return response()->json(['user' => $user->fresh()]);
    }
}
