import React from 'react';
import { getSession } from '@/lib/session';
import { logOutAction } from '@/app/actions/auth';

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 overflow-hidden font-sans px-4">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-8 shadow-2xl shadow-black/50">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Vault Icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
            <svg 
              className="w-8 h-8 text-indigo-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={1.5}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" 
              />
            </svg>
          </div>

          {/* Welcome Text */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
              Welcome inside, {session?.name}!
            </h2>
            <p className="text-sm text-zinc-400">
              You are authenticated. Your session is active.
            </p>
          </div>

          {/* User Details Box */}
          <div className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 text-left space-y-3">
            <div className="flex justify-between text-xs border-b border-zinc-850 pb-2">
              <span className="text-zinc-500 font-medium">NAME</span>
              <span className="text-zinc-300 font-semibold">{session?.name}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-850 pb-2">
              <span className="text-zinc-500 font-medium">EMAIL</span>
              <span className="text-zinc-300 font-semibold">{session?.email}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 font-medium">USER ID</span>
              <span className="text-zinc-400 font-mono text-[10px]">{session?.userId}</span>
            </div>
          </div>

          {/* Log Out Action */}
          <form action={logOutAction} className="w-full">
            <button
              type="submit"
              className="w-full h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 font-semibold rounded-xl text-sm transition-all duration-300 active:scale-98"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
