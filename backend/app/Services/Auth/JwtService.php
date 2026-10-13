<?php

namespace App\Services\Auth;

use App\Models\User;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use RuntimeException;
use Throwable;

class JwtService
{
    private const ALGORITHM = 'HS256';

    public function issueToken(User $user): string
    {
        $now = now()->timestamp;
        $expiresAt = $now + $this->ttlSeconds();

        $payload = [
            'iss' => config('app.url'),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $expiresAt,
            'sub' => $user->id,
            'email' => $user->email,
            'role' => $user->role?->name,
        ];

        return JWT::encode($payload, $this->signingKey(), self::ALGORITHM);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function decodeToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->signingKey(), self::ALGORITHM));
            $payload = json_decode(json_encode($decoded), true);

            return is_array($payload) ? $payload : null;
        } catch (ExpiredException|SignatureInvalidException $exception) {
            return null;
        } catch (Throwable $exception) {
            return null;
        }
    }

    public function ttlSeconds(): int
    {
        $minutes = (int) env('JWT_TTL_MINUTES', 60);

        return max(1, $minutes) * 60;
    }

    private function signingKey(): string
    {
        $jwtSecret = (string) env('JWT_SECRET', '');

        if ($jwtSecret !== '') {
            return $jwtSecret;
        }

        $appKey = (string) config('app.key', '');

        if ($appKey === '') {
            throw new RuntimeException('JWT signing key is not configured.');
        }

        if (str_starts_with($appKey, 'base64:')) {
            $decoded = base64_decode(substr($appKey, 7), true);

            if ($decoded !== false) {
                return $decoded;
            }
        }

        return $appKey;
    }
}
