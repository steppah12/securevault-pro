import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Input, Label, Card } from '@/components/ui';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password);
        if (error) toast.error(error);
      } else if (mode === 'signup') {
        const { error } = await signUpWithPassword(email, password, firstName, lastName);
        if (error) toast.error(error);
        else { toast.success('Account created — check your email to confirm.'); setSent(true); }
      } else {
        const { error } = await signInWithMagicLink(email);
        if (error) toast.error(error);
        else { toast.success('Magic link sent — check your email.'); setSent(true); }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-normal">SecureVault</h1>
          <p className="text-sm text-muted-foreground mt-1">Enterprise document security</p>
        </div>

        {sent ? (
          <p className="text-sm text-center text-muted-foreground py-6">Check your inbox at <strong>{email}</strong> to continue.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">First name</Label><Input className="mt-1" value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
                <div><Label className="text-xs">Last name</Label><Input className="mt-1" value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {mode !== 'magic' && (
              <div>
                <Label className="text-xs">Password</Label>
                <Input className="mt-1" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full h-10">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
            </Button>
          </form>
        )}

        {!sent && (
          <div className="mt-5 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            {mode !== 'signin' && <button onClick={() => setMode('signin')} className="hover:text-foreground">Have an account? Sign in</button>}
            {mode !== 'signup' && <button onClick={() => setMode('signup')} className="hover:text-foreground">Need an account? Sign up</button>}
            {mode !== 'magic' && <button onClick={() => setMode('magic')} className="hover:text-foreground">Use a magic link instead</button>}
          </div>
        )}
      </Card>
    </div>
  );
}
