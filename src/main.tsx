import React, { useMemo, useState } from 'react'
import { Bell, Check, ChevronRight, CircleAlert, Copy, Landmark, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Tab = 'Overview' | 'Funds' | 'Transfers' | 'Activity'
type TransferReceipt = { amount: number; fee: number; traceId: string; referenceNo: string; date: string }

// In production this must be served by a protected backend and allow-listed in the payment connector.
const GOTYME_DESTINATION = { bank: 'GoTyme Bank', label: 'Bankada safeguarded storage', last4: '4821' }
const SENDER = { label: 'Bankada wallet', last4: '9036' }
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const mask = (last4: string) => `•••• ${last4}`
const money = (n: number) => php.format(n)
function makeId(prefix: string) { return `${prefix}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(7, '0')}` }

function App() {
  const [tab, setTab] = useState<Tab>('Overview'), [amountInput, setAmountInput] = useState(''), [isDebug, setIsDebug] = useState(true), [isSubmitting, setIsSubmitting] = useState(false), [receipt, setReceipt] = useState<TransferReceipt | null>(null), [toast, setToast] = useState('')
  const amount = Number(amountInput), fee = 0, amountValid = Number.isFinite(amount) && amount > 0 && amount <= 113000, total = amountValid ? amount + fee : 0
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const date = useMemo(() => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), [receipt])
  async function submitTransfer(e: React.FormEvent) { e.preventDefault(); if (!isDebug || !amountValid || isSubmitting) return; setIsSubmitting(true); await new Promise(resolve => window.setTimeout(resolve, 650)); setReceipt({ amount, fee, traceId: makeId('DBG-TRACE'), referenceNo: makeId('DBG-REF'), date }); setIsSubmitting(false) }
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">B</span><span>bankada</span></div><div className="top-actions"><button className="icon-btn" onClick={() => notify('You are all caught up')} aria-label="Notifications"><Bell size={19}/></button><div className="avatar">KM</div></div></header>
    <section className="hero"><div><p className="eyebrow">SECURE GROUP SAVINGS</p><h1>Good morning, Kent <span>✦</span></h1><p className="muted">Keep your shared plans moving, safely.</p></div><div className="sync"><span className="online-dot"/>Synced just now</div></section>
    <nav className="tabs">{(['Overview', 'Funds', 'Transfers', 'Activity'] as Tab[]).map(item => <button className={tab === item ? 'tab active' : 'tab'} onClick={() => { setTab(item); setReceipt(null) }} key={item}>{item}</button>)}</nav>
    {tab === 'Overview' && <Overview onTransfer={() => setTab('Transfers')} />}
    {tab === 'Transfers' && <section className="transfer-layout"><div className="transfer-main">{!receipt ? <>
      <div className="view-heading"><div><p className="eyebrow">MOVE TO SAVINGS</p><h2>Send to GoTyme</h2><p>Move funds from your Bankada wallet to safeguarded storage.</p></div><span className="secure-tag"><LockKeyhole size={14}/> Private session</span></div>
      <div className="sandbox-notice"><CircleAlert size={19}/><div><strong>Sandbox debug mode</strong><p>This is a simulated transfer. It cannot send money, alter a real GoTyme account, or generate a provider receipt.</p></div></div>
      <form className="transfer-form" onSubmit={submitTransfer}><AccountCard from/><div className="transfer-arrow">↓</div><AccountCard/>
        <label className="amount-label">Amount to send <div className="amount-field"><span>₱</span><input inputMode="decimal" type="number" min="1" max="113000" step="0.01" placeholder="0.00" value={amountInput} onChange={e => setAmountInput(e.target.value)} aria-describedby="amount-help" autoComplete="off" /></div><small id="amount-help">Available in Bankada: ₱113,000.00</small></label>
        {amountInput && !amountValid && <p className="form-error">Enter an amount between ₱1.00 and ₱113,000.00.</p>}
        <div className="summary"><div><span>Transfer fee</span><strong>{money(fee)}</strong></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></div>
        <label className="debug-toggle"><input type="checkbox" checked={isDebug} onChange={e => setIsDebug(e.target.checked)} /><span className="switch"/><span><strong>Debug simulation only</strong><small>No external payment request will be made.</small></span></label>
        <button className="send-button" disabled={!amountValid || !isDebug || isSubmitting}>{isSubmitting ? 'Simulating transfer…' : `Simulate sending ${money(total)}`}</button></form>
      </> : <ReceiptView receipt={receipt} onDone={() => { setReceipt(null); setAmountInput(''); setTab('Overview') }} onCopy={notify} />}</div>
      <aside className="security-panel"><ShieldCheck size={25}/><h3>Designed for safer transfers</h3><ul><li>Destination is fixed and not user-editable.</li><li>Account numbers are masked in the interface.</li><li>Receipt details exist only in this private session.</li><li>Production transfers require a server-side, idempotent payment flow.</li></ul><p>Never share a receipt or reference number publicly.</p></aside></section>}
    {(tab === 'Funds' || tab === 'Activity') && <section className="empty-view"><div className="empty-icon"><ReceiptText size={26}/></div><h2>{tab}</h2><p>Your shared data will sync securely across devices.</p></section>}
    <footer><ShieldCheck size={15}/> Account details are masked to protect your privacy</footer>{toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </main>
}
function AccountCard({ from = false }) { const a = from ? SENDER : GOTYME_DESTINATION; return <section className={`account-card${from ? '' : ' locked'}`}><div className={`account-icon${from ? '' : ' gotyme'}`}>{from ? <WalletCards size={20}/> : <Landmark size={20}/>}</div><div><span>{from ? 'FROM' : 'TO · IMMUTABLE DESTINATION'}</span><strong>{from ? a.label : a.bank}</strong><p>{from ? mask(a.last4) : `${a.label} · ${mask(a.last4)}`}</p></div>{from ? <Check className="account-check" size={19}/> : <LockKeyhole className="account-lock" size={18}/>}</section> }
function Overview({ onTransfer }: { onTransfer: () => void }) { return <><section className="balance-card"><div className="card-heading"><div><p className="card-label">GROUP WALLET BALANCE</p><div className="balance">₱113,000 <span>+8.4%</span></div></div><div className="wallet-icon"><WalletCards size={23}/></div></div><div className="balance-footer"><span>₱9,500 contributed this month</span><button className="balance-action" onClick={onTransfer}>Send to GoTyme <ChevronRight size={15}/></button></div></section><div className="section-title"><h2>Quick actions</h2></div><section className="quick-grid"><button onClick={onTransfer}><Landmark size={20}/><span>Send to GoTyme</span><small>Move to safeguarded storage</small></button><button><ReceiptText size={20}/><span>Transfer records</span><small>Private and masked</small></button><button><ShieldCheck size={20}/><span>Security controls</span><small>Protect your group funds</small></button></section></> }
function ReceiptView({ receipt, onDone, onCopy }: { receipt: TransferReceipt; onDone: () => void; onCopy: (s: string) => void }) { const copy = async (value: string) => { await navigator.clipboard?.writeText(value); onCopy('Copied privately to your clipboard') }; return <div className="receipt-view"><div className="success-icon"><Check size={28}/></div><p className="eyebrow">SIMULATION COMPLETE</p><h2>Your sandbox receipt</h2><p className="receipt-subtitle">No money moved. These IDs were generated by Bankada’s local debug simulator—not GoTyme.</p><section className="receipt-card"><div className="receipt-top"><div><span>Transfer method</span><strong>Bankada → GoTyme</strong></div><ReceiptText size={24}/></div><ReceiptRow label="Sent bank account" value={`${GOTYME_DESTINATION.bank} ${mask(GOTYME_DESTINATION.last4)}`} /><ReceiptRow label="Sender" value={`${SENDER.label} ${mask(SENDER.last4)}`} /><ReceiptRow label="Transfer fee" value={money(receipt.fee)} /><div className="receipt-total"><span>Total</span><strong>{money(receipt.amount + receipt.fee)}</strong></div><ReceiptRow label="Trace ID" value={receipt.traceId} copy={() => copy(receipt.traceId)} /><ReceiptRow label="Reference no." value={receipt.referenceNo} copy={() => copy(receipt.referenceNo)} /><ReceiptRow label="Date of transfer" value={receipt.date} /><div className="receipt-private"><LockKeyhole size={14}/> Visible only in this session; not saved on this device.</div></section><button className="send-button" onClick={onDone}>Done</button></div> }
function ReceiptRow({ label, value, copy }: { label: string; value: string; copy?: () => void }) { return <div className="receipt-row"><span>{label}</span><div><strong>{value}</strong>{copy && <button className="copy" onClick={copy} aria-label={`Copy ${label}`}><Copy size={14}/></button>}</div></div> }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
