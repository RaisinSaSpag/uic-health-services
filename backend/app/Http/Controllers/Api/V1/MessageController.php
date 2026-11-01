<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /**
     * Fetch the global group chat thread.
     */
    public function groupThread(Request $request): JsonResponse
    {
        $messages = Message::query()
            ->with(['sender.role'])
            ->where('is_group_chat', true)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (Message $m) => [
                'id' => $m->id,
                'sender_id' => $m->sender_id,
                'sender_name' => $m->sender ? trim($m->sender->first_name . ' ' . $m->sender->last_name) : 'Unknown',
                'sender_role' => $m->sender?->role?->name ?? 'staff',
                'body' => $m->body,
                'created_at' => $m->created_at?->toIso8601String(),
                'from_me' => $m->sender_id === $request->user()->id,
            ]);

        return response()->json($messages);
    }

    /**
     * Send a message to the global group chat.
     */
    public function sendGroupMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message = Message::create([
            'sender_id' => $request->user()->id,
            'recipient_id' => null,
            'is_group_chat' => true,
            'body' => trim((string) $validated['body']),
        ]);

        return response()->json([
            'id' => $message->id,
            'sender_id' => $message->sender_id,
            'sender_name' => trim($request->user()->first_name . ' ' . $request->user()->last_name),
            'sender_role' => $request->user()->role?->name ?? 'staff',
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
            'from_me' => true,
        ], 201);
    }
}