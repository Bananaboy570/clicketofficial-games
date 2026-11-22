import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Inbox,
  ExternalLink,
} from 'lucide-react';
import { BlookArt } from './BlookArt';
import { apiFetch } from '../lib/apiClient';
import {
  signInWithGooglePopup,
  signUpWithEmailConfirmation,
  resendConfirmationEmail,
  reloadAndCheckEmailConfirmation,
  signInWithEmailAndGetStatus,
} from '../firebase';

export interface TradeHistoryItem {
  id: string;
  timestamp: string;
  partnerUsername: string;
  gaveBlookId: string;
  receivedBlookId: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  verified: boolean;
  tokens: number;
  inventory: Record<string, number>;
  clickUpgradeLevel: number;
  bestDailyClicks: number;
  equippedBlookId: string;
  lastDailyPlayAt?: number | null;
  lastWheelSpinAt?: number | null;
  lastHourlyClaimAt?: number | null;
  tradeHistory?: TradeHistoryItem[];
  clanId?: string | null;
  achievements?: string[];
}

interface AuthScreenProps {
  onAuthenticated: (user: AuthenticatedUser, sessionToken: string) => void;
}

const GoogleLogoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.13H1.03v3.14C3.04 21.15 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.03 14.02c-.25-.72-.39-1.49-.39-2.29 0-.8.14-1.57.39-2.29V6.3H1.03A11.98 11.98 0 0 0 0 11.73c0 1.93.46 3.76 1.03 5.43l4-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.04 2.85 1.03 6.3l4 3.14c.98-2.94 3.73-4.69 6.97-4.69Z"
    />
  </svg>
);

function getFirebaseErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code || '');
  }
  return '';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'SIGNUP' | 'LOGIN'>('SIGNUP');
  const [step, setStep] = useState<'FORM' | 'VERIFY'>('FORM');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email confirmation state
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [checkingConfirm, setCheckingConfirm] = useState(false);
  const checkingConfirmRef = useRef(false);
  const [needsFirebaseEmailSetup, setNeedsFirebaseEmailSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const exchangeFirebaseToken = useCallback(
    async (idToken: string, userEmail: string, displayName: string, chosenUsername?: string) => {
      const res = await apiFetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          email: userEmail,
          displayName,
          username: chosenUsername || displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not sign into CLICKET.');
      }
      onAuthenticated(data.user, data.sessionToken);
    },
    [onAuthenticated]
  );

  const handleCheckEmailConfirmed = useCallback(
    async (silent = false) => {
      if (checkingConfirmRef.current) return;
      if (!silent) {
        setError(null);
        setInfoMsg(null);
      }
      checkingConfirmRef.current = true;
      setCheckingConfirm(true);
      try {
        const status = await reloadAndCheckEmailConfirmation();
        if (!status.verified) {
          if (!silent) {
            setError(
              'Not confirmed yet! Please open the email we sent, click the confirmation link, and then press this button again.'
            );
          }
          return;
        }
        await exchangeFirebaseToken(
          status.idToken,
          status.email || pendingEmail,
          status.displayName || pendingUsername,
          pendingUsername
        );
      } catch (err: unknown) {
        if (!silent) {
          setError(
            err instanceof Error ? err.message : 'Could not verify email confirmation status.'
          );
        }
      } finally {
        checkingConfirmRef.current = false;
        setCheckingConfirm(false);
      }
    },
    [exchangeFirebaseToken, pendingEmail, pendingUsername]
  );

  // Automatically complete login if user returns to this tab after clicking their confirmation link
  useEffect(() => {
    if (step !== 'VERIFY') return;
    const onFocus = () => {
      handleCheckEmailConfirmed(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [step, handleCheckEmailConfirmed]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setNeedsFirebaseEmailSetup(false);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanUsername.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // Check username uniqueness before creating the Firebase account
      const checkRes = await apiFetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, email: cleanEmail }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        setError(checkData.error || 'Please choose a different username.');
        return;
      }

      const result = await signUpWithEmailConfirmation(cleanEmail, password, cleanUsername);
      if (result.status === 'ALREADY_VERIFIED') {
        await exchangeFirebaseToken(
          result.idToken,
          result.email,
          result.displayName,
          cleanUsername
        );
        return;
      }

      setPendingEmail(result.email);
      setPendingUsername(cleanUsername);
      setStep('VERIFY');
    } catch (err: unknown) {
      const code = getFirebaseErrorCode(err);
      if (code === 'auth/email-already-in-use' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('An account with that email already exists! Please switch to Log In.');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many email requests right now. Please wait a minute and try again.');
      } else if (code === 'auth/operation-not-allowed') {
        setNeedsFirebaseEmailSetup(true);
        setError(
          'Firebase rejected sending the confirmation email because Email/Password sign-in is still disabled in Firebase Console.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not send confirmation email. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resending) return;
    setError(null);
    setInfoMsg(null);
    setResending(true);
    try {
      await resendConfirmationEmail();
      setInfoMsg(`A fresh confirmation email was sent to ${pendingEmail}! Check your inbox and spam folder.`);
    } catch (err: unknown) {
      const code = getFirebaseErrorCode(err);
      if (code === 'auth/too-many-requests') {
        setError('Please wait a minute before requesting another confirmation email.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not resend confirmation email.'
        );
      }
    } finally {
      setResending(false);
    }
  };

  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setNeedsFirebaseEmailSetup(false);

    const cleanIdentifier = email.trim();
    if (!cleanIdentifier || !password) {
      setError('Please enter your email or username and password.');
      return;
    }

    setLoading(true);
    try {
      let targetEmail = cleanIdentifier.includes('@') ? cleanIdentifier.toLowerCase() : '';
      if (!targetEmail) {
        const resolveRes = await apiFetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanIdentifier }),
        });
        const resolveData = await resolveRes.json();
        if (resolveData.email) {
          targetEmail = String(resolveData.email).toLowerCase();
        }
      }

      if (targetEmail) {
        try {
          const fbStatus = await signInWithEmailAndGetStatus(targetEmail, password);
          if (!fbStatus.verified) {
            setPendingEmail(fbStatus.email);
            setPendingUsername(fbStatus.displayName);
            await resendConfirmationEmail().catch(() => {});
            setInfoMsg('Please confirm your email address via the link sent to your inbox first.');
            setStep('VERIFY');
            return;
          }
          await exchangeFirebaseToken(fbStatus.idToken, fbStatus.email, fbStatus.displayName);
          return;
        } catch (fbErr: unknown) {
          const code = getFirebaseErrorCode(fbErr);
          if (code === 'auth/too-many-requests') {
            setError('Too many failed attempts. Please wait a moment and try again.');
            return;
          }
          // Fall through to legacy server login if user predates Firebase Email/Password auth
        }
      }

      // Legacy backend login fallback
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanIdentifier,
          username: cleanIdentifier,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email/username or password.');
        return;
      }
      onAuthenticated(data.user, data.sessionToken);
    } catch {
      setError('Network error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMsg(null);
    setNeedsFirebaseEmailSetup(false);
    setGoogleLoading(true);
    try {
      const googleResult = await signInWithGooglePopup();
      await exchangeFirebaseToken(
        googleResult.idToken,
        googleResult.email,
        googleResult.displayName
      );
    } catch (err: unknown) {
      const code = getFirebaseErrorCode(err);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google sign-in popup was closed.');
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not yet added to Firebase Authorized Domains for Google Sign-In. Please sign up with Email above or add this domain in Firebase Console.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not complete Google Sign-In. Please try again or use Email.'
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#f87171] flex flex-col items-center justify-center p-4 relative overflow-y-auto select-none">
      {/* Subtle Checkered Background Pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.09]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.6) 2px, transparent 2px), linear-gradient(15deg, rgba(255,255,255,0.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.22) 75%, transparent 75%, transparent)`,
          backgroundSize: '110px 110px',
        }}
      />

      {/* Top Red Bar with CLICKET Logo */}
      <div className="fixed top-0 inset-x-0 h-16 bg-[#dc2626] shadow-[0_4px_15px_rgba(0,0,0,0.18)] flex items-center justify-between px-6 z-20">
        <div className="flex items-baseline gap-2">
          <span
            className="text-white tracking-wide drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]"
            style={{
              fontFamily: "'Lexend', sans-serif",
              fontWeight: 'bold',
              fontSize: '33px',
              lineHeight: '57px',
            }}
          >
            CLICKET
          </span>
          <span
            className="text-white/80 tracking-normal select-none"
            style={{
              fontFamily: "'Lexend', sans-serif",
              fontWeight: 300,
              fontSize: '12px',
              lineHeight: '1',
            }}
          >
            v1.0.0
          </span>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="relative z-10 w-full max-w-md mt-16 mb-8">
        {/* Decorative Blooks Peeking Above Card */}
        <div className="flex items-end justify-center gap-4 -mb-4 relative z-20 pointer-events-none">
          <div className="w-16 h-16 -rotate-12 drop-shadow-md">
            <BlookArt id="tightrope-walker" className="w-full h-full" />
          </div>
          <div className="w-20 h-20 drop-shadow-lg">
            <BlookArt id="jester" className="w-full h-full" />
          </div>
          <div className="w-16 h-16 rotate-12 drop-shadow-md">
            <BlookArt id="magician" className="w-full h-full" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-[0_10px_0_rgba(0,0,0,0.18)] border-4 border-[#dc2626]/20">
          {step === 'VERIFY' ? (
            /* EMAIL CONFIRMATION LINK SCREEN */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep('FORM');
                    setError(null);
                    setInfoMsg(null);
                  }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  aria-label="Back to sign up"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-titan text-2xl text-[#dc2626] leading-tight">
                    Confirm Your Email
                  </h2>
                  <p className="font-nunito font-bold text-xs text-slate-500 truncate max-w-[280px]">
                    Confirmation link sent to <strong className="text-slate-700">{pendingEmail}</strong>
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-3 px-4 py-2.5 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-700 font-nunito font-extrabold text-xs">
                  {error}
                </div>
              )}

              {infoMsg && (
                <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-nunito font-extrabold text-xs">
                  {infoMsg}
                </div>
              )}

              <div className="mb-5 p-4 rounded-2xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center shrink-0">
                  <Inbox className="w-5 h-5" />
                </div>
                <div className="text-xs font-nunito font-bold text-slate-700 leading-relaxed">
                  Check your inbox (and Spam/Junk folder) for an email confirmation link sent to{' '}
                  <strong className="text-slate-900">{pendingEmail}</strong>. Click the link inside
                  the email, then click the button below to enter CLICKET.
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={checkingConfirm}
                  onClick={() => handleCheckEmailConfirmed(false)}
                  className="w-full py-3 rounded-2xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#dc2626] text-white font-titan text-lg tracking-wide cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    {checkingConfirm
                      ? 'Checking Confirmation...'
                      : 'I Confirmed My Email — Enter CLICKET'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-nunito font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending...' : 'Resend Confirmation Email'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Segmented Sign Up / Log In Switch */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('SIGNUP');
                    setError(null);
                    setInfoMsg(null);
                    setNeedsFirebaseEmailSetup(false);
                  }}
                  className={`py-2.5 rounded-xl font-titan text-lg transition-all cursor-pointer ${
                    mode === 'SIGNUP'
                      ? 'bg-[#dc2626] text-white shadow-[0_3px_0_#991b1b]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('LOGIN');
                    setError(null);
                    setInfoMsg(null);
                    setNeedsFirebaseEmailSetup(false);
                  }}
                  className={`py-2.5 rounded-xl font-titan text-lg transition-all cursor-pointer ${
                    mode === 'LOGIN'
                      ? 'bg-[#dc2626] text-white shadow-[0_3px_0_#991b1b]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Log In
                </button>
              </div>

              {error && (
                <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-700 font-nunito font-extrabold text-sm">
                  <p>{error}</p>
                  {needsFirebaseEmailSetup && (
                    <div className="mt-2 pt-2 border-t border-rose-200 text-xs font-bold text-rose-800 space-y-1">
                      <p>To send real confirmation emails (takes 15 seconds):</p>
                      <p>1. Open Firebase Console → Authentication → Sign-in method</p>
                      <p>2. Click Email/Password → toggle Enable ON → Save</p>
                      <a
                        href="https://console.firebase.google.com/project/gen-lang-client-0177865590/authentication/providers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-black text-[11px]"
                      >
                        <span>Open Firebase Sign-in Providers</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* SIGN UP OR LOG IN FORM */}
              <form
                onSubmit={mode === 'SIGNUP' ? handleSignUp : handleLogIn}
                className="flex flex-col gap-4"
              >
                {mode === 'SIGNUP' && (
                  <div>
                    <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                      USERNAME
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={30}
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a unique username"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 font-nunito font-bold text-slate-800 focus:outline-none focus:border-[#dc2626]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                    {mode === 'SIGNUP' ? 'EMAIL ADDRESS' : 'EMAIL OR USERNAME'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={mode === 'SIGNUP' ? 'email' : 'text'}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        mode === 'SIGNUP' ? 'you@example.com' : 'Enter your email or username'
                      }
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 font-nunito font-bold text-slate-800 focus:outline-none focus:border-[#dc2626]"
                    />
                  </div>
                  {mode === 'SIGNUP' && (
                    <p className="mt-1 font-nunito font-bold text-[11px] text-slate-400">
                      We&apos;ll send an email confirmation link to this address.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-nunito font-black text-xs text-slate-500 mb-1">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-slate-200 font-nunito font-bold text-slate-800 focus:outline-none focus:border-[#dc2626]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="mt-1 w-full py-3 rounded-2xl bg-[#f87171] hover:brightness-105 active:translate-y-0.5 active:shadow-none shadow-[0_5px_0_#dc2626] text-white font-titan text-xl tracking-wide cursor-pointer transition-all disabled:opacity-60"
                >
                  {loading
                    ? mode === 'SIGNUP'
                      ? 'Sending Email...'
                      : 'Logging In...'
                    : mode === 'SIGNUP'
                    ? 'Send Confirmation Email'
                    : 'Log In to CLICKET'}
                </button>
              </form>

              {/* Divider + Sign in with Google */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="font-nunito font-black text-xs text-slate-400 uppercase">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={googleLoading || loading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 active:translate-y-0.5 border-2 border-slate-200 shadow-[0_3px_0_#e2e8f0] active:shadow-none text-slate-700 font-nunito font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-all disabled:opacity-60"
              >
                <GoogleLogoIcon />
                <span>{googleLoading ? 'Signing in with Google...' : 'Sign in with Google'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
