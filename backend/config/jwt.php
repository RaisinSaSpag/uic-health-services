<?php

return [
    /*
    |--------------------------------------------------------------------------
    | JWT Configuration
    |--------------------------------------------------------------------------
    |
    | The secret used to sign JWTs. If not set, the app falls back to APP_KEY
    | (which is fine for development but not ideal for production — set a
    | dedicated JWT_SECRET in production .env for clean key rotation).
    |
    | TTL is in minutes. Default 60 = 1 hour.
    |
    */

    'secret' => env('JWT_SECRET'),

    'ttl_minutes' => (int) env('JWT_TTL_MINUTES', 60),
];