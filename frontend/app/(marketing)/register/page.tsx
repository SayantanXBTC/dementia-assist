'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { fadeUp, staggerContainer } from '@/lib/variants';

export default function RegisterPage() {
  const router = useRouter();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      if (msg === 'auth/popup-closed-by-user' || msg === 'auth/cancelled-popup-request') {
        // user dismissed — no error shown
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      if (msg === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in instead.');
      } else if (msg === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (msg === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full animate-float"
             style={{ background: 'radial-gradient(circle,rgba(214,233,248,0.5) 0%,transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 rounded-full animate-float-slow"
             style={{ background: 'radial-gradient(circle,rgba(253,223,196,0.55) 0%,transparent 70%)', filter: 'blur(55px)' }} />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md"
      >
        <motion.div variants={fadeUp} custom={0}
          className="rounded-3xl p-8 md:p-10 shadow-warm-lg border border-white/70"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <span className="font-serif text-3xl font-bold"
                    style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                RecallPal
              </span>
            </Link>
            <p className="font-dm-sans text-text-mid text-sm mt-1">Create your free account — it only takes a moment.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block font-dm-sans text-sm font-medium text-text-mid mb-1.5" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 font-dm-sans text-sm text-text-dark border border-black/10 outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15 transition-all"
                style={{ background: 'rgba(255,255,255,0.8)' }}
                placeholder="e.g. Sarah Johnson"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-dm-sans text-sm font-medium text-text-mid mb-1.5" htmlFor="email">
                Email address <span className="text-gold">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 font-dm-sans text-sm text-text-dark border border-black/10 outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15 transition-all"
                style={{ background: 'rgba(255,255,255,0.8)' }}
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-dm-sans text-sm font-medium text-text-mid mb-1.5" htmlFor="password">
                Password <span className="text-gold">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl px-4 py-3 pr-11 font-dm-sans text-sm text-text-dark border border-black/10 outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15 transition-all"
                  style={{ background: 'rgba(255,255,255,0.8)' }}
                  placeholder="At least 6 characters"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-soft hover:text-gold transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block font-dm-sans text-sm font-medium text-text-mid mb-1.5" htmlFor="confirm">
                Confirm password <span className="text-gold">*</span>
              </label>
              <input
                id="confirm"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 font-dm-sans text-sm text-text-dark border border-black/10 outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15 transition-all"
                style={{ background: 'rgba(255,255,255,0.8)' }}
                placeholder="Repeat your password"
              />
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl px-4 py-3 text-sm font-dm-sans border"
                style={{ background: 'rgba(253,220,225,0.6)', borderColor: 'rgba(217,123,138,0.3)', color: '#9B3A4A' }}>
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full py-3.5 rounded-2xl font-dm-sans font-semibold text-white shadow-gold disabled:opacity-60 disabled:cursor-not-allowed transition-all mt-1"
              style={{ background: 'linear-gradient(135deg,#C9943A,#F0C97A)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <span className="font-dm-sans text-xs text-text-soft">or continue with</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Google Sign-In */}
          <motion.button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            className="w-full py-3 rounded-2xl font-dm-sans font-medium text-sm flex items-center justify-center gap-3 border transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(0,0,0,0.10)', color: '#3A2F28' }}
          >
            {/* Google G */}
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M47.532 24.552c0-1.636-.147-3.2-.421-4.704H24.48v8.898h13.01c-.56 3.02-2.258 5.576-4.81 7.292v6.063h7.782c4.553-4.194 7.07-10.37 7.07-17.55z" fill="#4285F4"/>
              <path d="M24.48 48c6.528 0 12.004-2.164 16.005-5.899l-7.783-6.063c-2.162 1.45-4.926 2.307-8.222 2.307-6.32 0-11.675-4.267-13.585-10.004H2.838v6.25C6.82 42.672 15.055 48 24.48 48z" fill="#34A853"/>
              <path d="M10.895 28.341A14.367 14.367 0 0 1 10.11 24c0-1.504.258-2.964.785-4.341v-6.25H2.838A23.977 23.977 0 0 0 .48 24c0 3.862.927 7.518 2.358 10.591l8.057-6.25z" fill="#FBBC05"/>
              <path d="M24.48 9.655c3.562 0 6.754 1.225 9.27 3.626l6.953-6.952C36.48 2.411 30.998.001 24.48.001 15.055.001 6.82 5.329 2.838 13.409l8.057 6.25c1.91-5.737 7.265-10.004 13.585-10.004z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </motion.button>

          <p className="text-center font-dm-sans text-sm text-text-soft mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-gold font-medium hover:underline">
              Log in
            </Link>
          </p>
        </motion.div>

        <p className="text-center font-dm-sans text-xs text-text-soft mt-5">
          <Link href="/" className="hover:text-gold transition-colors">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
