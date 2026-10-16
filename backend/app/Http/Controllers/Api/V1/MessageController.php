<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    /**
     * List users in the same campus (excluding self) with last message preview
     * and unread count.
     */
    public function contacts(Request $request): JsonResponse
    {
        $me = $request->user();

        if (! $me->campus_id) {
            return response()->json([]);
        }

        $users = User::query()
            ->with(['role', 'campus'])
            ->where('id', '!=', $me->id)
            ->where('is_active', true)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        $lastMessages = Message::query()
            ->where(function ($q) use ($me) {
                $q->where('sender_id', $me->id)->orWhere('recipient_id', $me->id);
            })
            ->orderByDesc('created_at')
            ->get()
            ->groupBy(function (Message $m) use ($me) {
                return $m->sender_id === $me->id ? $m->recipient_id : $m->sender_id;
            });

        $unreadCounts = Message::query()
            ->select('sender_id', DB::raw('COUNT(*) as unread'))
            ->where('recipient_id', $me->id)
            ->whereNull('read_at')
            ->groupBy('sender_id')
            ->pluck('unread', 'sender_id');

        $result = $users->map(function (User $u) use ($lastMessages, $unreadCounts) {
            $last = $lastMessages->get($u->id)?->first();

                        return [
                'id' => $u->id,
                'first_name' => $u->first_name,
                'last_name' => $u->last_name,
                'email' => $u->email,
                'role' => $u->role?->name,
                'campus_id' => $u->campus_id,
                'campus_name' => $u->campus?->name,
                'last_message' => $last ? [
                    'body' => $last->body,
                    'created_at' => $last->created_at?->toIso8601String(),
                    'from_me' => $last->sender_id !== $u->id,
                ] : null,
                'unread_count' => (int) ($unreadCounts[$u->id] ?? 0),
            ];
        });

        return response()->json($result);
    }

    /**
     * Fetch the full message thread between the current user and another user.
     */
    public function thread(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        $messages = Message::query()
            ->where(function ($q) use ($me, $user) {
                $q->where('sender_id', $me->id)->where('recipient_id', $user->id);
            })
            ->orWhere(function ($q) use ($me, $user) {
                $q->where('sender_id', $user->id)->where('recipient_id', $me->id);
            })
            ->orderBy('created_at')
            ->get()
            ->map(fn (Message $m) => [
                'id' => $m->id,
                'sender_id' => $m->sender_id,
                'recipient_id' => $m->recipient_id,
                'body' => $m->body,
                'read_at' => $m->read_at?->toIso8601String(),
                'created_at' => $m->created_at?->toIso8601String(),
                'from_me' => $m->sender_id === $me->id,
            ]);

        return response()->json($messages);
    }

    /**
     * Send a message to another user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $me = $request->user();

        if ((int) $validated['recipient_id'] === (int) $me->id) {
            return response()->json(['message' => 'You cannot message yourself.'], 422);
        }

        $recipient = User::find($validated['recipient_id']);

         if (! $recipient) {
            return response()->json(['message' => 'Recipient not found.'], 404);
        }

        $message = Message::create([
            'sender_id' => $me->id,
            'recipient_id' => $recipient->id,
            'body' => trim((string) $validated['body']),
        ]);

        return response()->json([
            'id' => $message->id,
            'sender_id' => $message->sender_id,
            'recipient_id' => $message->recipient_id,
            'body' => $message->body,
            'read_at' => null,
            'created_at' => $message->created_at?->toIso8601String(),
            'from_me' => true,
        ], 201);
    }

    /**
     * Mark all messages from a specific sender as read.
     */
    public function markRead(Request $request, User $user): JsonResponse
    {
        $me = $request->user();

        $updated = Message::query()
            ->where('sender_id', $user->id)
            ->where('recipient_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['marked_read' => $updated]);
    }

    /**
     * Total unread message count for the current user.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = Message::query()
            ->where('recipient_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread' => $count]);
    }
}