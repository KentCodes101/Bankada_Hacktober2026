import React, { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Bell, Check, ChevronRight, CircleAlert, GitBranch, HandCoins, History, Landmark, LockKeyhole, MapPin, Plus, Receipt, ShieldCheck, Sparkles, ThumbsUp, Users, UsersRound, WalletCards, X, Zap } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { TripPlanner } from './TripPlanner'
import { GroupHub } from './GroupHub'
import { GroupSavingsHistory, GroupSavingsOverview, ReceiptTransactionForm } from './GroupSavings'
import { FloatingChatIcon } from './components/FloatingChatIcon'
import { Dashboard as LedgerDashboard } from './Dashboard'
import './styles.css'
import './auth.css'

import { createClient, type User } from '@supabase/supabase-js'

const cleanEnv = (value: unknown) => typeof value === 'string' ? value.trim().replace(/^['\"]|['\"]$/g, '') : ''
const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
  .replace(/^sb_publishable(?!_)/, 'sb_publishable_')
const validSupabaseUrl = /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl)
const supabase = validSupabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

type Tab = 'Overview' | 'Groups' | 'Cash in' | 'Withdrawals' | 'History'
type Rail = 'GoTyme Bank' | 'Maya' | 'GCash'
type ReceiptType = { kind: 'Send cash' | 'Group withdrawal'; rail: Rail; amount: number; fee: number; traceId: string; referenceNo: string; date: string; target: string }
type LedgerItem = { id: string; kind: string; status: string; amount: number; time: string; hash: string; traceId?: string; referenceNo?: string }

const GROUP_ACCOUNT = { label: 'Bankada group savings', last4: '4821' }
const USER_ACCOUNT = { label: 'Kent M. personal account', last4: '9036' }
const MEMBERS = ['Kent', 'Jasmine', 'Alex', 'Marco', 'Bea']
const AVATARS = ['🦊', '🐼', '🐨', '🐸', '🐯', '🐰', '🐻', '🐱']
const OTP_TTL_SECONDS = 180
const funds = [{ name: 'Japan trip', amount: 52400, goal: 80000, icon: '✈', color: '#e7f6ef' }, { name: 'House repairs', amount: 18600, goal: 30000, icon: '⌂', color: '#fff0e4' }, { name: 'Emergency fund', amount: 42000, goal: 50000, icon: '☂', color: '#e9efff' }]

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const money = (n: number) => php.format(n), mask = (last4: string) => `•••• ${last4}`
const generateId = (prefix: string) => `${prefix}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(7, '0')}`
const now = () => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
const ledgerEntry = (kind: string, status: string, amount: number): LedgerItem => ({ id: generateId('DBG-LEDGER'), kind, status, amount, time: now(), hash: `0x${generateId('proof').replace('-', '').slice(-12)}` })

function LandingPage({ user, passwordRecovery, onPasswordResetComplete }: { user: User | null; passwordRecovery: boolean; onPasswordResetComplete: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true); // Default to sign up so new users land here!
  const [stage, setStage] = useState<'credentials' | 'verify' | 'forgot-password' | 'reset-password'>(passwordRecovery ? 'reset-password' : 'credentials')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('')
  const [otpDeadline, setOtpDeadline] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(OTP_TTL_SECONDS)
  const [authLinkExpired] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return ['otp_expired', 'access_denied'].includes(params.get('error_code') ?? '')
  })

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const authError = new URLSearchParams(hash.slice(1))
    const errorCode = authError.get('error_code')
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      setIsSignUp(false)
      setStage('credentials')
      setShowModal(true)
      setErrorMessage('That email confirmation link expired. Sign in again to continue. For code entry, change Supabase’s Confirm signup template to use {{ .Token }} instead of {{ .ConfirmationURL }}.')
      if (supabase) void supabase.auth.signOut({ scope: 'local' })
    }
  }, [])

  useEffect(() => {
    if (!passwordRecovery) return
    setIsSignUp(false)
    setStage('reset-password')
    setShowModal(true)
    setErrorMessage('')
    setSuccessMessage('')
  }, [passwordRecovery])

  useEffect(() => {
    if (stage !== 'verify' || otpDeadline === null) return
    const updateRemaining = () => setRemainingSeconds(Math.max(0, Math.ceil((otpDeadline - Date.now()) / 1000)))
    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(interval)
  }, [stage, otpDeadline])

  const openAuthModal = (signupMode: boolean) => {
    setIsSignUp(signupMode);
    setStage('credentials')
    setOtp('')
    setUsername('')
    setConfirmPassword('')
    setOtpDeadline(null)
    setErrorMessage('')
    setSuccessMessage('')
    setShowModal(true);
  };

  const startOtpTimer = () => {
    setOtp('')
    setOtpDeadline(Date.now() + OTP_TTL_SECONDS * 1000)
    setRemainingSeconds(OTP_TTL_SECONDS)
    setStage('verify')
  }

  const resendCode = async () => {
    if (!supabase) return
    setLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
      if (error) throw error
      startOtpTimer()
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not resend the verification code.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerificationForSignIn = async () => {
    if (!supabase) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage('Enter the email address for your existing account first.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail })
      if (error) throw error
      startOtpTimer()
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not send a verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendPasswordResetEmail = async () => {
    if (!supabase) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage('Enter the email address for your account first.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}?auth=reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
      if (error) throw error
      setSuccessMessage('If an account exists for this email, we sent a password-reset link. Open it to set a new password in Bankada.')
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not send a password-reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveNewPassword = async () => {
    if (!supabase) return
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)) {
      setErrorMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut({ scope: 'local' })
      setPassword('')
      setConfirmPassword('')
      setIsSignUp(false)
      setStage('credentials')
      setSuccessMessage('Password updated. Log in with your new password.')
      onPasswordResetComplete()
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not update your password. Please request a new reset link and try again.')
    } finally {
      setLoading(false)
    }
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMessage('Supabase URL is invalid. Use your project API URL, such as https://your-project-ref.supabase.co, not the Supabase dashboard URL.');
      return;
    }
    setLoading(true);
    setErrorMessage('')
    try {
      if (stage === 'forgot-password') {
        await sendPasswordResetEmail()
      } else if (stage === 'reset-password') {
        await saveNewPassword()
      } else if (stage === 'credentials' && isSignUp) {
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) throw new Error('Username must be 3–24 characters using letters, numbers, or underscores.')
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)) throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.')
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email address.')
        const metadata = {
          username: username.trim(),
          full_name: username.trim(),
          email_address: email.trim().toLowerCase(),
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: metadata },
        })
        if (error) throw error
        if (data.user?.email_confirmed_at && data.session) setShowModal(false)
        else startOtpTimer()
      } else if (stage === 'credentials') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) throw error
        if (!data.user.email_confirmed_at) {
          await resendVerificationForSignIn()
          return
        }
        setShowModal(false)
      } else if (stage === 'verify') {
        if (!otpDeadline || Date.now() >= otpDeadline) {
          setRemainingSeconds(0)
          throw new Error('This code expired after 3 minutes. Request a new code to continue.')
        }
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: otp.trim(),
          type: 'signup',
        })
        if (error) throw error
        setOtp('')
        setOtpDeadline(null)
        setShowModal(false)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Authentication failed. Please try again.'
      if (stage === 'credentials' && !isSignUp && /email.*not.*confirm|confirm.*email/i.test(message)) {
        await resendVerificationForSignIn()
        return
      }
      setErrorMessage(/504|gateway|fetch/i.test(message)
        ? 'Supabase did not complete the request. Check that your password meets the 8-character policy, then retry. If it continues, verify Supabase Auth email/SMTP settings.'
        : message)
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="landing-shell">
      <nav className="landing-nav">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark">B</span><span>bankada</span>
        </button>
        <div className="nav-links">
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('how-it-works')}>How It Works</button>
          <button onClick={() => scrollTo('why-bankada')}>Why Bankada</button>
          <button onClick={() => scrollTo('open-source')}>Open Source</button>
        </div>
        <div className="nav-actions">
          <button className="nav-signin" onClick={() => openAuthModal(false)}>Log In</button>
          <button className="primary nav-cta" onClick={() => openAuthModal(true)}>Sign Up <ArrowRight size={15}/></button>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="hero-copy">
          <p className="landing-kicker"><span className="kicker-dot"/> THE GROUP WALLET FOR YOUR BARKADA</p>
          <h1>Group savings without the <em>awkward money talks.</em></h1>
          <p className="hero-subcopy">Pool funds with your barkada, verify transfer receipts instantly with OpenAI Vision, and democratic-vote on every withdrawal—all in one open-source ledger.</p>
          <div className="hero-buttons">
            <button className="primary hero-button" onClick={() => openAuthModal(true)}>Start a Group Fund <ArrowRight size={17}/></button>
            <button className="link-button" onClick={() => scrollTo('how-it-works')}>How It Works <ChevronRight size={16}/></button>
          </div>
        </div>
      </header>

      {showModal && (
        <div className="modal-backdrop" onClick={() => { if (stage === 'credentials') setShowModal(false) }}>
          <div className="signin-modal" onClick={e => e.stopPropagation()}>
            {stage !== 'verify' && stage !== 'reset-password' && <button className="modal-close" onClick={() => setShowModal(false)}><X size={19}/></button>}
            <span className="modal-mark"><span className="brand-mark">B</span></span>

            <h2>{stage === 'verify' ? 'Verify your email' : stage === 'forgot-password' ? 'Reset your password' : stage === 'reset-password' ? 'Set a new password' : isSignUp ? 'Create your bankada account' : 'Welcome back to bankada'}</h2>
            <p>{stage === 'verify' ? `Enter the code sent to ${email}. It expires in 3 minutes.` : stage === 'forgot-password' ? 'Enter your email and we’ll send a link to reset your password.' : stage === 'reset-password' ? 'Choose a new password for your Bankada account.' : isSignUp ? 'Create an account with your email and password. We’ll email you a verification code.' : 'Log in with your email and password.'}</p>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {stage === 'credentials' && <>
                {isSignUp && <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />}
                <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={isSignUp ? 8 : 1} required />
                {isSignUp && <label className="auth-field">Confirm password
                  <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
                </label>}
              </>}
              {stage === 'forgot-password' && <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />}
              {stage === 'reset-password' && <>
                <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
                <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
              </>}
              {stage === 'verify' && <>
                <p className="otp-countdown" role="timer">{remainingSeconds > 0
                  ? `Code expires in ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
                  : 'Code expired. Request a new code.'}</p>
                <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Email verification code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))} disabled={remainingSeconds <= 0} required />
                {remainingSeconds <= 0 && <button type="button" className="auth-text-button" disabled={loading} onClick={() => void resendCode()}>Send a new code</button>}
              </>}
              {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
              {successMessage && <p className="auth-success" role="status">{successMessage}</p>}
              <button type="submit" className="primary modal-button" disabled={loading} style={{ width: '100%', marginTop: '5px' }}>
                {loading ? 'Please wait...' : stage === 'verify' ? 'Verify email' : stage === 'forgot-password' ? 'Send reset email' : stage === 'reset-password' ? 'Save new password' : isSignUp ? 'Create account & send email code' : 'Log in'} <ArrowRight size={16}/>
              </button>
              {stage === 'verify' && remainingSeconds > 0 && <button type="button" className="auth-text-button" disabled={loading || !supabase} onClick={() => void resendCode()}>Resend code</button>}
              {stage === 'credentials' && <div className="auth-switch">
                {isSignUp ? <>Already have an account? <button type="button" onClick={() => { setIsSignUp(false); setErrorMessage('') }}>Log in</button></> : <><button type="button" className="auth-text-button" onClick={() => { setStage('forgot-password'); setErrorMessage(''); setSuccessMessage('') }}>Forgot password?</button><br/>Don't have an account yet? <button type="button" onClick={() => { setIsSignUp(true); setErrorMessage('') }}>Sign up</button></>}
              </div>}
              {stage === 'forgot-password' && <div className="auth-switch"><button type="button" onClick={() => { setIsSignUp(false); setStage('credentials'); setErrorMessage(''); setSuccessMessage('') }}>Back to Log in</button></div>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileSetup({ user, onComplete }: { user: User; onComplete: (user: User) => void }) {
  const [avatar, setAvatar] = useState(String(user.user_metadata.avatar_emoji ?? AVATARS[0]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_emoji: avatar },
      })
      if (updateError) throw updateError
      onComplete(data.user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="profile-shell">
    <header className="profile-brand"><span className="brand-mark">B</span><span>bankada</span></header>
    <section className="profile-card">
      <p className="landing-kicker"><span className="kicker-dot"/> YOUR ACCOUNT IS VERIFIED</p>
      <h1>Make it yours</h1>
      <p className="profile-intro">Choose an avatar your barkada will see.</p>
      <form className="auth-form" onSubmit={saveProfile}>
        <fieldset className="avatar-picker">
          <legend>Choose an avatar</legend>
          <div className="avatar-options">
            {AVATARS.map(option => <button key={option} type="button" className={avatar === option ? 'avatar-option selected' : 'avatar-option'}
              aria-label={`Choose ${option} avatar`} aria-pressed={avatar === option} onClick={() => setAvatar(option)}>{option}</button>)}
          </div>
        </fieldset>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="primary modal-button" disabled={loading}>{loading ? 'Saving profile…' : 'Save profile and continue'} <ArrowRight size={16}/></button>
      </form>
    </section>
  </main>
}

function WorkspaceDashboard({ user, onSignOut, onOpenLedger }: { user: User; onSignOut: () => void; onOpenLedger: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview'); const [receipt, setReceipt] = useState<ReceiptType | null>(null); const [toast, setToast] = useState(''); const [ledger, setLedger] = useState<LedgerItem[]>([ledgerEntry('Group savings deposit', 'Simulated', 25000)]); const [withdrawal, setWithdrawal] = useState<{ amount: number; rail: Rail; consents: number } | null>(null); const [alert, setAlert] = useState<LedgerItem | null>(null); const [plannerOpen, setPlannerOpen] = useState(false); const [signOutConfirmationOpen, setSignOutConfirmationOpen] = useState(false)
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const complete = (kind: ReceiptType['kind'], rail: Rail, amount: number, target: string) => { const r: ReceiptType = { kind, rail, amount, fee: 0, traceId: generateId('DBG-TRACE'), referenceNo: generateId('DBG-REF'), date: now(), target }; setReceipt(r); setLedger(prev => [ledgerEntry(kind, 'Simulated — no funds moved', amount), ...prev]) }
  const createWithdrawal = (amount: number, rail: Rail) => { setWithdrawal({ amount, rail, consents: 1 }); setLedger(prev => [ledgerEntry('Withdrawal request', 'Awaiting unanimous consent', amount), ...prev]); notify('Withdrawal request created. Your consent is recorded.') }
  const addConsent = () => { if (!withdrawal) return; const consents = withdrawal.consents + 1; if (consents === MEMBERS.length) { complete('Group withdrawal', withdrawal.rail, withdrawal.amount, `${USER_ACCOUNT.label} ${mask(USER_ACCOUNT.last4)}`); setWithdrawal(null); notify('All members consented. Debug withdrawal simulated.') } else setWithdrawal({ ...withdrawal, consents }) }
  const reportUnknown = () => { const event = { ...ledgerEntry('Unidentified withdrawal', 'Alerted all members — simulated', 1750), traceId: generateId('DBG-TRACE'), referenceNo: generateId('DBG-REF') }; setAlert(event); setLedger(prev => [event, ...prev]); notify('Unidentified withdrawal alert sent to all members.') }
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">B</span><span>bankada</span></div>
      <div className="top-actions"><button className="icon-btn" aria-label="Notifications" onClick={() => tab !== 'Withdrawals' && notify('No new secure alerts')}><Bell size={19}/></button>
        <span className="account-email">{user.email}</span><button className="auth-signout" onClick={onOpenLedger}>Ledger</button><button className="auth-signout" onClick={() => setSignOutConfirmationOpen(true)}>Sign out</button>
        <span className="avatar" aria-label={`${user.user_metadata.full_name} avatar`}>{user.user_metadata.avatar_emoji}</span>
      </div>
    </header>
    <section className="hero"><div><p className="eyebrow">GROUP SAVINGS DASHBOARD</p>
      <h1>Good morning, {user.user_metadata.full_name} <span>✦</span></h1>
      <p className="muted">Group savings change only when a member submits a receipt. Bankada never accesses a bank or wallet.</p></div>
      <div className="sync"><span className="online-dot"/> Secure session</div>
    </section>
    <nav className="tabs">{(['Overview', 'Groups', 'Cash in', 'Withdrawals', 'History'] as Tab[]).map(x =>
      <button key={x} className={tab === x ? 'tab active' : 'tab'} onClick={() => { setTab(x); setReceipt(null) }}>{x}</button>)}
    </nav>
    {tab === 'Overview' && <Overview user={user} goSend={() => setTab('Cash in')} goWithdraw={() => setTab('Withdrawals')} goHistory={() => setTab('History')}/>}
    {tab === 'Groups' && <GroupHub user={user} supabase={supabase}/>}
    {tab === 'Cash in' && <ReceiptTransactionForm user={user} supabase={supabase} direction="cash_in"/>}
    {tab === 'Withdrawals' && <ReceiptTransactionForm user={user} supabase={supabase} direction="withdrawal"/>}
    {tab === 'History' && <GroupSavingsHistory user={user} supabase={supabase}/>}
    <div className="trip-planner-floating-panel" role="dialog" aria-label="AI trip planner" aria-hidden={!plannerOpen} hidden={!plannerOpen}>
      <TripPlanner fundId={import.meta.env.VITE_TRIP_FUND_ID ?? ""}/>
    </div>
    <FloatingChatIcon isOpen={plannerOpen} onClick={() => setPlannerOpen(open => !open)}/>
    <footer><ShieldCheck size={15}/> Savings records are receipt-backed and visible only to current group members.</footer>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    {signOutConfirmationOpen && <div className="modal-backdrop" role="presentation" onClick={() => setSignOutConfirmationOpen(false)}>
      <section className="signout-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description" onClick={event => event.stopPropagation()}>
        <h2 id="signout-title">Sign out of Bankada?</h2>
        <p id="signout-description">You’ll need to log in again to access your dashboard.</p>
        <div className="signout-confirmation-actions">
          <button type="button" className="signout-cancel" onClick={() => setSignOutConfirmationOpen(false)}>Cancel</button>
          <button type="button" className="signout-confirm" onClick={onSignOut}>Sign out</button>
        </div>
      </section>
    </div>}
  </main>
}

function Overview({ user, goSend, goWithdraw, goHistory }: { user: User; goSend: () => void; goWithdraw: () => void; goHistory: () => void }) { return <><GroupSavingsOverview user={user} supabase={supabase} onHistory={goHistory}/><div className="section-title"><h2>Sinking funds</h2></div><section className="fund-grid">{funds.map(f => <article className="fund-card" key={f.name}><div className="fund-top"><span className="fund-icon" style={{ background: f.color }}>{f.icon}</span><button className="more" aria-label={`More options for ${f.name}`}>•••</button></div><h3>{f.name}</h3><p className="fund-amount">₱{f.amount.toLocaleString()} <span>/ ₱{f.goal.toLocaleString()}</span></p><div className="progress"><span style={{ width: `${(f.amount / f.goal) * 100}%` }}/></div><p className="fund-meta">{Math.round((f.amount / f.goal) * 100)}% funded</p></article>)}</section><div className="section-title"><h2>Receipt actions</h2></div><section className="quick-grid"><button onClick={goSend}><Landmark size={20}/><span>Record cash in</span><small>Upload a transaction receipt</small></button><button onClick={goWithdraw}><UsersRound size={20}/><span>Record withdrawal</span><small>Upload a transaction receipt</small></button><button onClick={goHistory}><History size={20}/><span>Receipt history</span><small>Member-only evidence</small></button></section></> }
function RailSelect({ rail, setRail }: { rail: Rail; setRail: (v: Rail) => void }) { return <label className="select-label">Destination rail<select value={rail} onChange={e => setRail(e.target.value as Rail)}>{(['GoTyme Bank', 'Maya', 'GCash'] as Rail[]).map(x => <option key={x}>{x}</option>)}</select></label> }
function TransferPanel({ onComplete, receipt }: { onComplete: (kind: ReceiptType['kind'], rail: Rail, amount: number, target: string) => void; receipt: ReceiptType | null }) { const [amount, setAmount] = useState(''), [rail, setRail] = useState<Rail>('GoTyme Bank'); const valid = Number(amount) > 0 && Number(amount) <= 113000; const submit = (e: React.FormEvent) => { e.preventDefault(); if (valid) onComplete('Send cash', rail, Number(amount), `${GROUP_ACCOUNT.label} ${mask(GROUP_ACCOUNT.last4)}`) }; return <section className="transfer-layout"><div className="transfer-main">{receipt?.kind === 'Send cash' ? <ReceiptView receipt={receipt}/> : <><div className="view-heading"><div><p className="eyebrow">MULTI-RAIL SEND</p><h2>Send cash</h2><p>Debug connector routing for GoTyme, Maya, and GCash.</p></div><span className="secure-tag"><LockKeyhole size={14}/> Debug only</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div><form className="transfer-form" onSubmit={submit}><section className="account-card locked"><div className="account-icon gotyme"><Landmark size={20}/></div><div><span>FROM · GROUP SAVINGS</span><strong>{GROUP_ACCOUNT.label}</strong><p>{mask(GROUP_ACCOUNT.last4)}</p></div><LockKeyhole className="account-lock" size={18}/></section><div className="transfer-arrow">↓</div><RailSelect rail={rail} setRail={setRail}/><label className="amount-label">Amount to send <div className="amount-field"><span>₱</span><input type="number" min="1" max="113000" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/></div><small>Available in simulated group savings: ₱113,000.00</small></label><button className="send-button" disabled={!valid}>Simulate send through {rail}</button></form></>}</div><aside className="security-panel"><ShieldCheck size={25}/><h3>Release safeguards</h3><ul><li>All members must authorize a withdrawal.</li><li>Destination ownership must be verified server-side.</li><li>Only verified provider webhooks may settle transfers.</li><li>Unknown provider events alert every group member.</li><li>Receipts require owner-only access controls.</li></ul><p>Debug Mode cannot be switched off by this interface.</p></aside></section> }
function WithdrawalPanel({ withdrawal, receipt, onCreate, onConsent, onUnknown, alert }: { withdrawal: { amount: number; rail: Rail; consents: number } | null; receipt: ReceiptType | null; onCreate: (a: number, r: Rail) => void; onConsent: () => void; onUnknown: () => void; alert: LedgerItem | null }) { const [amount, setAmount] = useState(''), [rail, setRail] = useState<Rail>('GoTyme Bank'); const valid = Number(amount) > 0 && Number(amount) <= 113000; return <section className="transfer-layout"><div className="transfer-main">{receipt?.kind === 'Group withdrawal' ? <ReceiptView receipt={receipt}/> : <><div className="view-heading"><div><p className="eyebrow">GROUP-CONSENT WITHDRAWAL</p><h2>Withdraw from group savings</h2><p>Cash is never released until every active group member consents.</p></div><span className="secure-tag"><UsersRound size={14}/> 5 of 5 required</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div>{withdrawal ? <section className="consent-card"><UsersRound size={25}/><p className="eyebrow">PENDING APPROVAL</p><h3>{money(withdrawal.amount)} to your {withdrawal.rail} destination</h3><p>Consent is simulated sequentially for this debug session. A production system requires each member’s signed approval on the server.</p><div className="member-list">{MEMBERS.map((name, i) => <span className={i < withdrawal.consents ? 'consented' : ''} key={name}>{i < withdrawal.consents ? <Check size={13}/> : <span className="pending-dot"/>}{name}</span>)}</div><strong className="approval-count">{withdrawal.consents} of {MEMBERS.length} consents recorded</strong><button className="send-button" onClick={onConsent}>Simulate next member consent</button></section> : <form className="transfer-form" onSubmit={e => { e.preventDefault(); if (valid) onCreate(Number(amount), rail) }}><section className="account-card locked"><div className="account-icon gotyme"><Landmark size={20}/></div><div><span>ORIGIN · IMMUTABLE</span><strong>GoTyme Bank · Bankada group savings</strong><p>{mask(GROUP_ACCOUNT.last4)}</p></div><LockKeyhole className="account-lock" size={18}/></section><div className="transfer-arrow">↓</div><RailSelect rail={rail} setRail={setRail}/><label className="amount-label">Withdrawal amount <div className="amount-field"><span>₱</span><input type="number" min="1" max="113000" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/></div></label><button className="send-button" disabled={!valid}>Request unanimous consent</button></form>}</>}<section className="unknown-section"><div><AlertTriangle size={20}/><div><strong>Test unidentified withdrawal alert</strong><p>Simulates a provider webhook for an external or unrecognized withdrawal. It does not contact a bank.</p></div></div><button className="outline-button" onClick={onUnknown}>Simulate alert</button>{alert && <article className="unknown-alert"><AlertTriangle size={19}/><div><strong>Alert sent to all group members</strong><div className="receipt-row"><span>Transfer method</span><div><strong>Unidentified external withdrawal</strong></div></div><div className="receipt-row"><span>Date & time</span><div><strong>{alert.time}</strong></div></div><div className="receipt-row"><span>Trace ID</span><div><strong>{alert.traceId ?? 'Not available in debug event'}</strong></div></div><div className="receipt-row"><span>Reference no.</span><div><strong>{alert.referenceNo ?? 'Not available in debug event'}</strong></div></div><div className="receipt-row"><span>Total transferred</span><div><strong>{money(alert.amount)}</strong></div></div><div className="receipt-row"><span>Account / mobile used</span><div><strong>Unidentified — masked pending investigation</strong></div></div><div className="receipt-row"><span>Origin bank account</span><div><strong>GoTyme Bank {mask(GROUP_ACCOUNT.last4)}</strong></div></div></div></article>}</section></div><aside className="security-panel"><ShieldCheck size={25}/><h3>Release safeguards</h3><ul><li>All members must authorize a withdrawal.</li><li>Destination ownership must be verified server-side.</li><li>Only verified provider webhooks may settle transfers.</li><li>Unknown provider events alert every group member.</li><li>Receipts require owner-only access controls.</li></ul><p>Debug Mode cannot be switched off by this interface.</p></aside></section> }
function ReceiptView({ receipt }: { receipt: ReceiptType }) { return <div className="receipt-view"><div className="success-icon"><Check size={28}/></div><p className="eyebrow">DEBUG TRANSFER COMPLETE</p><h2>Sandbox receipt</h2><p className="receipt-subtitle">No money moved or was deposited. Provider trace and reference values will replace these debug IDs in production.</p><section className="receipt-card"><div className="receipt-row"><span>Transfer method</span><div><strong>Bankada → {receipt.rail}</strong></div></div><div className="receipt-row"><span>Origin bank account</span><div><strong>{receipt.target}</strong></div></div><div className="receipt-row"><span>{receipt.kind === 'Group withdrawal' ? 'User withdrawing' : 'User receiving'}</span><div><strong>{USER_ACCOUNT.label} {mask(USER_ACCOUNT.last4)}</strong></div></div><div className="receipt-row"><span>Transfer fee</span><div><strong>{money(receipt.fee)}</strong></div></div><div className="receipt-total"><span>Total</span><strong>{money(receipt.amount + receipt.fee)}</strong></div><div className="receipt-row"><span>Trace ID</span><div><strong>{receipt.traceId}</strong></div></div><div className="receipt-row"><span>Reference no.</span><div><strong>{receipt.referenceNo}</strong></div></div><div className="receipt-row"><span>Date of transfer</span><div><strong>{receipt.date}</strong></div></div><div className="receipt-private"><LockKeyhole size={14}/> Session-only receipt; account identifiers are masked.</div></section></div> }
function HistoryPanel({ ledger }: { ledger: LedgerItem[] }) { return <section className="history-view"><div className="view-heading"><div><p className="eyebrow">DEBUG AUDIT TRAIL</p><h2>Transaction history</h2><p>Bankada actions and observed GoTyme events are shown together.</p></div><span className="secure-tag"><ShieldCheck size={14}/> Proof chained</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div><div className="ledger-note"><LockKeyhole size={16}/><span>Demo only: each entry has a simulated hash. Production needs a server-held append-only ledger, signed provider webhooks, and optional permissioned-chain anchoring—not a public chain holding banking data.</span></div><div className="history-list">{ledger.map(x => <article className="history-row" key={x.id}><div><strong>{x.kind}</strong><p>{x.status} · {x.time}</p><small>{x.id} · {x.hash}</small></div><strong>{money(x.amount)}</strong></article>)}</div></section> }

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).get('auth') === 'reset-password')
  const [workspaceOpen, setWorkspaceOpen] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setAuthLoading(false)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message)
      } else {
        setUser(data.session?.user ?? null)
      }
      setAuthLoading(false)
    }).catch((cause: unknown) => {
      setAuthError(cause instanceof Error ? cause.message : 'Could not restore your session.')
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setAuthError(error.message)
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Could not sign out securely.')
    }
  }

  if (authLoading) return <div className="auth-loading" role="status">Loading your secure session…</div>
  if (authError) return <div className="auth-loading auth-error" role="alert">{authError}</div>
  if (user?.email && user.email_confirmed_at && !passwordRecovery) {
    const profileComplete = typeof user.user_metadata.full_name === 'string' &&
      user.user_metadata.full_name.trim().length > 0 &&
      AVATARS.includes(user.user_metadata.avatar_emoji)
    if (!profileComplete) {
      return <ProfileSetup user={user} onComplete={setUser}/>
    }
    return workspaceOpen
      ? <WorkspaceDashboard user={user} onOpenLedger={() => setWorkspaceOpen(false)} onSignOut={() => void signOut()}/>
      : <LedgerDashboard onOpenWorkspace={() => setWorkspaceOpen(true)} onSignOut={() => void signOut()}/>
  }
  return <LandingPage user={user} passwordRecovery={passwordRecovery} onPasswordResetComplete={() => {
    setPasswordRecovery(false)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search.replace(/[?&]auth=reset-password/, '').replace(/[?&]$/, '')}`)
  }}/>
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)
