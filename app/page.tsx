import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center space-y-12">
        {/* Header/Logo Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-indigo-500/5 mb-2">
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
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" 
            />
          </svg>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
            Every product that matters has a door.
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed max-w-xl mx-auto">
            Behind it is someone's account, their settings, their work, and their money. 
            Welcome to <span className="text-zinc-200 font-normal">The Gatekeeper</span>—authentication built the right way.
          </p>
        </div>

        {/* Actions Section */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-sm pt-4">
          <Link 
            href="/signup" 
            className="flex items-center justify-center w-full sm:w-48 h-12 bg-zinc-50 text-zinc-950 font-semibold rounded-xl hover:bg-zinc-200 transition-all duration-300 shadow-lg shadow-white/5 active:scale-95"
          >
            Sign Up
          </Link>
          <Link 
            href="/login" 
            className="flex items-center justify-center w-full sm:w-48 h-12 bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-300 active:scale-95"
          >
            Log In
          </Link>
        </div>

        {/* Small Footer/Info Text */}
        <p className="text-xs text-zinc-600 tracking-wider uppercase font-medium pt-8">
          Secured with Argon2-grade protection via Bcrypt & JWT sessions
        </p>
      </div>
    </main>
  );
}
