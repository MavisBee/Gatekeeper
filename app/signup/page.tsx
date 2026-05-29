'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { signUpAction, ActionResponse } from '@/app/actions/auth';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<ActionResponse['errors']>({});
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const response = await signUpAction({ name, email, password });
      if (!response.success && response.errors) {
        setErrors(response.errors);
      }
    });
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 overflow-hidden font-sans px-4">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl shadow-black/50">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
            Create an Account
          </h2>
          <p className="text-sm text-zinc-400">
            Get started by setting up your secure vault
          </p>
        </div>

        {errors?.global && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl text-center">
            {errors.global}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              disabled={isPending}
              className="w-full h-11 px-4 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-sm transition-colors text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
            />
            {errors?.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name[0]}</p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@domain.com"
              disabled={isPending}
              className="w-full h-11 px-4 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-sm transition-colors text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
            />
            {errors?.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email[0]}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 tracking-wide uppercase">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isPending}
              className="w-full h-11 px-4 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-sm transition-colors text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
            />
            {errors?.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password[0]}</p>
            )}
          </div>

          {/* Interactive Password Strength Meter */}
          {password && (
            <div className="pt-1">
              <PasswordStrengthMeter password={password} />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-semibold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-white/5 active:scale-98 flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? (
              <svg className="animate-spin h-5 w-5 text-zinc-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-zinc-500">
          Already have a key?{' '}
          <Link href="/login" className="text-zinc-300 hover:text-white transition-colors font-medium">
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
