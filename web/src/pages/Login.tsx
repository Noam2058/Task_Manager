import type * as React from 'react';
import { useState } from 'react';
import { Eye, EyeOff, ListChecks } from 'lucide-react';
import { supabase, configured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(/invalid/i.test(error.message) ? 'אימייל או סיסמה שגויים' : /rate|too many/i.test(error.message) ? 'יותר מדי ניסיונות — נסה שוב בעוד כמה דקות' : /not allowed|disabled/i.test(error.message) ? 'ההרשמה סגורה' : error.message);
    } else if (mode === 'signup') {
      setError('נשלח מייל אימות (אם מופעל). אחרי האימות — התחבר.');
      setMode('login');
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg p-4">
      <div className="pointer-events-none absolute -top-40 -end-40 h-[480px] w-[480px] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-40 -start-40 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #A25DDC, transparent 70%)' }} />
      <form onSubmit={submit} className="card relative w-full max-w-[384px] p-7 shadow-lg animate-rise">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded text-white shadow-md" style={{ background: 'linear-gradient(160deg,#7377F7,#4B4FE0)' }}><ListChecks className="h-6 w-6" strokeWidth={2.4} /></div>
          <div><h1 className="text-lg font-bold">{mode === 'login' ? 'ברוכים השבים' : 'יצירת חשבון'}</h1><p className="text-sm text-muted">ניהול משימות</p></div>
        </div>
        {!configured && <p className="mb-4 rounded bg-danger-soft p-3 text-sm text-danger">חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY בקובץ ‎.env</p>}
        <div className="space-y-4">
          <Field label="אימייל"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" required autoFocus /></Field>
          <Field label="סיסמה">
            <div className="relative">
              <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" required minLength={mode === 'signup' ? 10 : undefined} className="pe-10" />
              <button type="button" onClick={() => setShow(!show)} className="absolute end-2 top-1/2 -translate-y-1/2 text-subtle hover:text-text" aria-label={show ? 'הסתרה' : 'הצגה'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{mode === 'login' ? 'התחברות' : 'הרשמה'}</Button>
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="w-full text-center text-xs text-subtle hover:text-primary">
            {mode === 'login' ? 'פעם ראשונה? יצירת חשבון' : 'כבר יש חשבון? התחברות'}
          </button>
        </div>
      </form>
    </div>
  );
}
