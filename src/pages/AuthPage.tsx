import React, { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, FolderKanban, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const AuthPage: React.FC = () => {
  const { login, register, demoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const succeeded =
        mode === 'login'
          ? await login(email.trim(), password)
          : await register(name.trim(), email.trim(), password);
      if (!succeeded) {
        setError(
          mode === 'login'
            ? 'Could not sign in. Check your email and password, then try again.'
            : 'Could not create your account. This email may already be registered.'
        );
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      if (!(await demoLogin('alex'))) setError('Demo sign-in is currently unavailable. Please try again.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Demo sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-12 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/85 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between border-r border-slate-800 bg-slate-900/55 p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-400/20">
                <FolderKanban className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold tracking-tight text-white">KNOWBRIDGE <span className="text-sky-400">AI</span></div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Project continuity platform</div>
              </div>
            </div>

            <div className="mt-20 max-w-md">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-400/5 px-3 py-1.5 text-[11px] font-medium text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Evidence-grounded knowledge handover
              </div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
                Keep critical project knowledge <span className="text-sky-400">moving forward.</span>
              </h1>
              <p className="mt-5 text-sm leading-7 text-slate-400">
                Organize project sources, extract decisions and tasks, verify evidence with your team, and build a reliable handover dossier.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ['01', 'Connect sources'],
              ['02', 'Verify evidence'],
              ['03', 'Hand over clearly'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="font-mono text-[10px] text-sky-400">{number}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-300">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-9 lg:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-400/20">
              <FolderKanban className="h-5 w-5" />
            </span>
            <div className="text-sm font-bold tracking-tight text-white">KNOWBRIDGE <span className="text-sky-400">AI</span></div>
          </div>

          <div className="mb-7">
            <div className="text-xs font-medium text-sky-400">WELCOME TO KNOWBRIDGE</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login' ? 'Continue your team’s project handover.' : 'Start a secure project knowledge workspace.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Full name</span>
                <input
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Work email</span>
              <input
                autoComplete="email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                placeholder="you@company.com"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Password</span>
              <span className="relative block">
                <input
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-relaxed text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</span>
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">or</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleDemoLogin()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Continue with demo workspace
          </button>

          <p className="mt-6 text-center text-xs text-slate-400">
            {mode === 'login' ? 'New to KnowBridge?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode(mode === 'login' ? 'register' : 'login');
              }}
              className="font-semibold text-sky-400 transition hover:text-sky-300"
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <p className="mt-7 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Passwords are securely hashed and sessions are protected.
          </p>
        </section>
      </div>
    </main>
  );
};
