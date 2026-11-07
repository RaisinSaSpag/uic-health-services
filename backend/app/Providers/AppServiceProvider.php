<?php

namespace App\Providers;

use App\Models\PatientEnrollment;
use App\Observers\PatientEnrollmentObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        PatientEnrollment::observe(PatientEnrollmentObserver::class);
    }
}