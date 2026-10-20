import React, { useState } from 'react'
import { AlertTriangle, ArrowRight, Bell, Check, ChevronRight, CircleAlert, GitBranch, HandCoins, History, Landmark, LockKeyhole, MapPin, Plus, Receipt, ShieldCheck, Sparkles, ThumbsUp, Users, UsersRound, WalletCards, X, Zap } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { TripPlanner } from './TripPlanner'
import { FloatingChatIcon } from './components/FloatingChatIcon'
import './styles.css'

// 1. Supabase Client Setup
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

type Tab = 'Overview' | 'Send cash' | 'Withdrawals' | 'History'
type Rail = 'GoTyme Bank' | 'Maya' | 'GCash'
type ReceiptType = { kind: 'Send cash' | 'Group withdrawal'; rail: Rail; amount: number; fee: number; traceId: string; referenceNo: string; date: string; target: string }
type LedgerItem = { id: string; kind: string; status: string; amount: number; time: string; hash: string; traceId?: string; referenceNo?: string }

const GROUP_ACCOUNT = { label: 'Bankada group savings', last4: '4821' }
const USER_ACCOUNT = { label: 'Kent M. personal account', last4: '9036' }
const MEMBERS = ['Kent', 'Jasmine', 'Alex', 'Marco', 'Bea']
const funds = [{ name: 'Japan trip', amount: 52400, goal: 80000, icon: '✈', color: '#e7f6ef' }, { name: 'House repairs', amount: 18600, goal: 30000, icon: '⌂', color: '#fff0e4' }, { name: 'Emergency fund', amount: 42000, goal: 50000, icon: '☂', color: '#e9efff' }]

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const money = (n: number) => php.format(n), mask = (last4: string) => `•••• ${last4}`
const generateId = (prefix: string) => `${prefix}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(7, '0')}`
const now = () => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
const ledgerEntry = (kind: string, status: string, amount: number): LedgerItem => ({ id: generateId('DBG-LEDGER'), kind, status, amount, time: now(), hash: `0x${generateId('proof').replace('-', '').slice(-12)}` })

function LandingPage({ onAuthenticate }: { onAuthenticate: () => void }) {
  const [showModal, setShowModal] = useState(false); 
  const [isSignUp, setIsSignUp] = useState(true); // Default to sign up so new users land here!
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const openAuthModal = (signupMode: boolean) => {
    setIsSignUp(signupMode);
    setShowModal(true);
  };
  
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      // Supabase Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      setLoading(false);

      if (error) {
        alert('Sign-up error: ' + error.message);
      } else {
        alert('Account created successfully! You can now sign in.');
        setIsSignUp(false); // Switch over to sign in view
      }
    } else {
      // Supabase Sign In
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);

      if (error) {
        alert('Sign-in error: ' + error.message);
      } else {
        onAuthenticate(); 
      }
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
          <button className="nav-signin" onClick={() => openAuthModal(false)}>Sign In</button>
          <button className="primary nav-cta" onClick={() => openAuthModal(true)}>Get Started <ArrowRight size={15}/></button>
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
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="signin-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={19}/></button>
            <span className="modal-mark"><span className="brand-mark">B</span></span>
            
            <h2>{isSignUp ? 'Create your bankada account' : 'Welcome back to bankada'}</h2>
            <p>{isSignUp ? 'Sign up to start or join a group fund.' : 'Sign in to pick up where your barkada left off.'}</p>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '15px' }}>
              {isSignUp && (
                <input 
                  type="text" 
                  placeholder="Full name" 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                  required 
                />
              )}
              <input 
                type="email" 
                placeholder="Email address" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                required 
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                required 
              />
              
              <button type="submit" className="primary modal-button" disabled={loading} style={{ width: '100%', marginTop: '5px' }}>
                {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Continue to dashboard')} <ArrowRight size={16}/>
              </button>

              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px' }}>
                {isSignUp ? (
                  <span>Already have an account? <button type="button" onClick={() => setIsSignUp(false)} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button></span>
                ) : (
                  <span>Don't have an account yet? <button type="button" onClick={() => setIsSignUp(true)} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}>Sign Up</button></span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>('Overview'); const [receipt, setReceipt] = useState<ReceiptType | null>(null); const [toast, setToast] = useState(''); const [ledger, setLedger] = useState<LedgerItem[]>([ledgerEntry('Group savings deposit', 'Simulated', 25000)]); const [withdrawal, setWithdrawal] = useState<{ amount: number; rail: Rail; consents: number } | null>(null); const [alert, setAlert] = useState<LedgerItem | null>(null); const [plannerOpen, setPlannerOpen] = useState(false)
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const complete = (kind: ReceiptType['kind'], rail: Rail, amount: number, target: string) => { const r: ReceiptType = { kind, rail, amount, fee: 0, traceId: generateId('DBG-TRACE'), referenceNo: generateId('DBG-REF'), date: now(), target }; setReceipt(r); setLedger(prev => [ledgerEntry(kind, 'Simulated — no funds moved', amount), ...prev]) }
  const createWithdrawal = (amount: number, rail: Rail) => { setWithdrawal({ amount, rail, consents: 1 }); setLedger(prev => [ledgerEntry('Withdrawal request', 'Awaiting unanimous consent', amount), ...prev]); notify('Withdrawal request created. Your consent is recorded.') }
  const addConsent = () => { if (!withdrawal) return; const consents = withdrawal.consents + 1; if (consents === MEMBERS.length) { complete('Group withdrawal', withdrawal.rail, withdrawal.amount, `${USER_ACCOUNT.label} ${mask(USER_ACCOUNT.last4)}`); setWithdrawal(null); notify('All members consented. Debug withdrawal simulated.') } else setWithdrawal({ ...withdrawal, consents }) }
  const reportUnknown = () => { const event = { ...ledgerEntry('Unidentified withdrawal', 'Alerted all members — simulated', 1750), traceId: generateId('DBG-TRACE'), referenceNo: generateId('DBG-REF') }; setAlert(event); setLedger(prev => [event, ...prev]); notify('Unidentified withdrawal alert sent to all members.') }
  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">B</span><span>bankada</span></div><div className="top-actions"><button className="icon-btn" aria-label="Notifications" onClick={() => tab !== 'Withdrawals' && notify('No new secure alerts')}><Bell size={19}/></button><div className="avatar">KM</div></div></header><section className="hero"><div><p className="eyebrow">DEBUG MODE · NO REAL MONEY</p><h1>Good morning, Kent <span>✦</span></h1><p className="muted">Every transfer and alert below is a safe simulation.</p></div><div className="sync"><span className="online-dot"/> Sandbox protected</div></section><nav className="tabs">{(['Overview', 'Send cash', 'Withdrawals', 'History'] as Tab[]).map(x => <button key={x} className={tab === x ? 'tab active' : 'tab'} onClick={() => { setTab(x); setReceipt(null) }}>{x}</button>)}</nav>{tab === 'Overview' && <Overview goSend={() => setTab('Send cash')} goWithdraw={() => setTab('Withdrawals')}/>}{tab === 'Send cash' && <TransferPanel onComplete={complete} receipt={receipt}/>}{tab === 'Withdrawals' && <WithdrawalPanel withdrawal={withdrawal} receipt={receipt} onCreate={createWithdrawal} onConsent={addConsent} onUnknown={reportUnknown} alert={alert}/>}{tab === 'History' && <HistoryPanel ledger={ledger}/>}<div className="trip-planner-floating-panel" role="dialog" aria-label="AI trip planner" aria-hidden={!plannerOpen} hidden={!plannerOpen}><TripPlanner fundId={import.meta.env.VITE_TRIP_FUND_ID ?? ""}/></div><FloatingChatIcon isOpen={plannerOpen} onClick={() => setPlannerOpen(open => !open)}/> <footer><ShieldCheck size={15}/> Debug receipts and ledger entries are session-only and masked</footer>{toast && <div className="toast"><Check size={16}/>{toast}</div>}</main>
}

function Overview({ goSend, goWithdraw }: { goSend: () => void; goWithdraw: () => void }) { return <><section className="balance-card"><div className="card-heading"><div><p className="card-label">GROUP SAVINGS · GOTYME</p><div className="balance">₱113,000 <span>Debug</span></div></div><div className="wallet-icon"><WalletCards size={23}/></div></div><div className="balance-footer"><span>{GROUP_ACCOUNT.label} · {mask(GROUP_ACCOUNT.last4)}</span><button className="balance-action" onClick={goWithdraw}>Request withdrawal <ChevronRight size={15}/></button></div></section><div className="section-title"><h2>Sinking funds</h2></div><section className="fund-grid">{funds.map(f => <article className="fund-card" key={f.name}><div className="fund-top"><span className="fund-icon" style={{ background: f.color }}>{f.icon}</span><button className="more" aria-label={`More options for ${f.name}`}>•••</button></div><h3>{f.name}</h3><p className="fund-amount">₱{f.amount.toLocaleString()} <span>/ ₱{f.goal.toLocaleString()}</span></p><div className="progress"><span style={{ width: `${(f.amount / f.goal) * 100}%` }}/></div><p className="fund-meta">{Math.round((f.amount / f.goal) * 100)}% funded</p></article>)}</section><div className="section-title"><h2>Money actions</h2></div><section className="quick-grid"><button onClick={goSend}><Landmark size={20}/><span>Send cash</span><small>GoTyme, Maya, or GCash</small></button><button onClick={goWithdraw}><UsersRound size={20}/><span>Withdraw with consent</span><small>All 5 members must approve</small></button><button><History size={20}/><span>Audit history</span><small>Tamper-evident demo ledger</small></button></section></> }
function RailSelect({ rail, setRail }: { rail: Rail; setRail: (v: Rail) => void }) { return <label className="select-label">Destination rail<select value={rail} onChange={e => setRail(e.target.value as Rail)}>{(['GoTyme Bank', 'Maya', 'GCash'] as Rail[]).map(x => <option key={x}>{x}</option>)}</select></label> }
function TransferPanel({ onComplete, receipt }: { onComplete: (kind: ReceiptType['kind'], rail: Rail, amount: number, target: string) => void; receipt: ReceiptType | null }) { const [amount, setAmount] = useState(''), [rail, setRail] = useState<Rail>('GoTyme Bank'); const valid = Number(amount) > 0 && Number(amount) <= 113000; const submit = (e: React.FormEvent) => { e.preventDefault(); if (valid) onComplete('Send cash', rail, Number(amount), `${GROUP_ACCOUNT.label} ${mask(GROUP_ACCOUNT.last4)}`) }; return <section className="transfer-layout"><div className="transfer-main">{receipt?.kind === 'Send cash' ? <ReceiptView receipt={receipt}/> : <><div className="view-heading"><div><p className="eyebrow">MULTI-RAIL SEND</p><h2>Send cash</h2><p>Debug connector routing for GoTyme, Maya, and GCash.</p></div><span className="secure-tag"><LockKeyhole size={14}/> Debug only</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div><form className="transfer-form" onSubmit={submit}><section className="account-card locked"><div className="account-icon gotyme"><Landmark size={20}/></div><div><span>FROM · GROUP SAVINGS</span><strong>{GROUP_ACCOUNT.label}</strong><p>{mask(GROUP_ACCOUNT.last4)}</p></div><LockKeyhole className="account-lock" size={18}/></section><div className="transfer-arrow">↓</div><RailSelect rail={rail} setRail={setRail}/><label className="amount-label">Amount to send <div className="amount-field"><span>₱</span><input type="number" min="1" max="113000" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/></div><small>Available in simulated group savings: ₱113,000.00</small></label><button className="send-button" disabled={!valid}>Simulate send through {rail}</button></form></>}</div><aside className="security-panel"><ShieldCheck size={25}/><h3>Release safeguards</h3><ul><li>All members must authorize a withdrawal.</li><li>Destination ownership must be verified server-side.</li><li>Only verified provider webhooks may settle transfers.</li><li>Unknown provider events alert every group member.</li><li>Receipts require owner-only access controls.</li></ul><p>Debug Mode cannot be switched off by this interface.</p></aside></section> }
function WithdrawalPanel({ withdrawal, receipt, onCreate, onConsent, onUnknown, alert }: { withdrawal: { amount: number; rail: Rail; consents: number } | null; receipt: ReceiptType | null; onCreate: (a: number, r: Rail) => void; onConsent: () => void; onUnknown: () => void; alert: LedgerItem | null }) { const [amount, setAmount] = useState(''), [rail, setRail] = useState<Rail>('GoTyme Bank'); const valid = Number(amount) > 0 && Number(amount) <= 113000; return <section className="transfer-layout"><div className="transfer-main">{receipt?.kind === 'Group withdrawal' ? <ReceiptView receipt={receipt}/> : <><div className="view-heading"><div><p className="eyebrow">GROUP-CONSENT WITHDRAWAL</p><h2>Withdraw from group savings</h2><p>Cash is never released until every active group member consents.</p></div><span className="secure-tag"><UsersRound size={14}/> 5 of 5 required</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div>{withdrawal ? <section className="consent-card"><UsersRound size={25}/><p className="eyebrow">PENDING APPROVAL</p><h3>{money(withdrawal.amount)} to your {withdrawal.rail} destination</h3><p>Consent is simulated sequentially for this debug session. A production system requires each member’s signed approval on the server.</p><div className="member-list">{MEMBERS.map((name, i) => <span className={i < withdrawal.consents ? 'consented' : ''} key={name}>{i < withdrawal.consents ? <Check size={13}/> : <span className="pending-dot"/>}{name}</span>)}</div><strong className="approval-count">{withdrawal.consents} of {MEMBERS.length} consents recorded</strong><button className="send-button" onClick={onConsent}>Simulate next member consent</button></section> : <form className="transfer-form" onSubmit={e => { e.preventDefault(); if (valid) onCreate(Number(amount), rail) }}><section className="account-card locked"><div className="account-icon gotyme"><Landmark size={20}/></div><div><span>ORIGIN · IMMUTABLE</span><strong>GoTyme Bank · Bankada group savings</strong><p>{mask(GROUP_ACCOUNT.last4)}</p></div><LockKeyhole className="account-lock" size={18}/></section><div className="transfer-arrow">↓</div><RailSelect rail={rail} setRail={setRail}/><label className="amount-label">Withdrawal amount <div className="amount-field"><span>₱</span><input type="number" min="1" max="113000" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/></div></label><button className="send-button" disabled={!valid}>Request unanimous consent</button></form>}</>}<section className="unknown-section"><div><AlertTriangle size={20}/><div><strong>Test unidentified withdrawal alert</strong><p>Simulates a provider webhook for an external or unrecognized withdrawal. It does not contact a bank.</p></div></div><button className="outline-button" onClick={onUnknown}>Simulate alert</button>{alert && <article className="unknown-alert"><AlertTriangle size={19}/><div><strong>Alert sent to all group members</strong><div className="receipt-row"><span>Transfer method</span><div><strong>Unidentified external withdrawal</strong></div></div><div className="receipt-row"><span>Date & time</span><div><strong>{alert.time}</strong></div></div><div className="receipt-row"><span>Trace ID</span><div><strong>{alert.traceId ?? 'Not available in debug event'}</strong></div></div><div className="receipt-row"><span>Reference no.</span><div><strong>{alert.referenceNo ?? 'Not available in debug event'}</strong></div></div><div className="receipt-row"><span>Total transferred</span><div><strong>{money(alert.amount)}</strong></div></div><div className="receipt-row"><span>Account / mobile used</span><div><strong>Unidentified — masked pending investigation</strong></div></div><div className="receipt-row"><span>Origin bank account</span><div><strong>GoTyme Bank {mask(GROUP_ACCOUNT.last4)}</strong></div></div></div></article>}</section></div><aside className="security-panel"><ShieldCheck size={25}/><h3>Release safeguards</h3><ul><li>All members must authorize a withdrawal.</li><li>Destination ownership must be verified server-side.</li><li>Only verified provider webhooks may settle transfers.</li><li>Unknown provider events alert every group member.</li><li>Receipts require owner-only access controls.</li></ul><p>Debug Mode cannot be switched off by this interface.</p></aside></section> }
function ReceiptView({ receipt }: { receipt: ReceiptType }) { return <div className="receipt-view"><div className="success-icon"><Check size={28}/></div><p className="eyebrow">DEBUG TRANSFER COMPLETE</p><h2>Sandbox receipt</h2><p className="receipt-subtitle">No money moved or was deposited. Provider trace and reference values will replace these debug IDs in production.</p><section className="receipt-card"><div className="receipt-row"><span>Transfer method</span><div><strong>Bankada → {receipt.rail}</strong></div></div><div className="receipt-row"><span>Origin bank account</span><div><strong>{receipt.target}</strong></div></div><div className="receipt-row"><span>{receipt.kind === 'Group withdrawal' ? 'User withdrawing' : 'User receiving'}</span><div><strong>{USER_ACCOUNT.label} {mask(USER_ACCOUNT.last4)}</strong></div></div><div className="receipt-row"><span>Transfer fee</span><div><strong>{money(receipt.fee)}</strong></div></div><div className="receipt-total"><span>Total</span><strong>{money(receipt.amount + receipt.fee)}</strong></div><div className="receipt-row"><span>Trace ID</span><div><strong>{receipt.traceId}</strong></div></div><div className="receipt-row"><span>Reference no.</span><div><strong>{receipt.referenceNo}</strong></div></div><div className="receipt-row"><span>Date of transfer</span><div><strong>{receipt.date}</strong></div></div><div className="receipt-private"><LockKeyhole size={14}/> Session-only receipt; account identifiers are masked.</div></section></div> }
function HistoryPanel({ ledger }: { ledger: LedgerItem[] }) { return <section className="history-view"><div className="view-heading"><div><p className="eyebrow">DEBUG AUDIT TRAIL</p><h2>Transaction history</h2><p>Bankada actions and observed GoTyme events are shown together.</p></div><span className="secure-tag"><ShieldCheck size={14}/> Proof chained</span></div><div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Debug simulation is enforced</strong><p>No banking API is called, no provider balance can change, and all IDs are Bankada debug values—not GoTyme, Maya, or GCash references.</p></div></div><div className="ledger-note"><LockKeyhole size={16}/><span>Demo only: each entry has a simulated hash. Production needs a server-held append-only ledger, signed provider webhooks, and optional permissioned-chain anchoring—not a public chain holding banking data.</span></div><div className="history-list">{ledger.map(x => <article className="history-row" key={x.id}><div><strong>{x.kind}</strong><p>{x.status} · {x.time}</p><small>{x.id} · {x.hash}</small></div><strong>{money(x.amount)}</strong></article>)}</div></section> }

function App() { 
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  return isAuthenticated ? <Dashboard/> : <LandingPage onAuthenticate={() => setIsAuthenticated(true)}/> 
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)