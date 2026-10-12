import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bell, Camera, Check, ChevronRight, MapPin, Plus, Receipt, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import './styles.css'

type Tab = 'Overview' | 'Funds' | 'Trips' | 'Activity'
const funds = [{ name: 'Japan trip', amount: 52400, goal: 80000, icon: '🗾', color: '#e7f6ef' }, { name: 'House repairs', amount: 18600, goal: 30000, icon: '🏠', color: '#fff0e4' }, { name: 'Emergency fund', amount: 42000, goal: 50000, icon: '🛟', color: '#e9efff' }]

function App() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [toast, setToast] = useState('')
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">B</span><span>bankada</span></div><div className="top-actions"><button className="icon-btn" onClick={() => notify('You are all caught up')}><Bell size={19}/></button><div className="avatar">KM</div></div></header>
    <section className="hero"><div><p className="eyebrow">MONDAY, OCTOBER 12</p><h1>Good morning, Kent <span>✦</span></h1><p className="muted">Your group is on track for its goals.</p></div><div className="sync"><span className="online-dot"/>Synced just now</div></section>
    <nav className="tabs">{(['Overview','Funds','Trips','Activity'] as Tab[]).map(item => <button className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
    {tab === 'Overview' && <>
      <section className="balance-card"><div className="card-heading"><div><p className="card-label">GROUP WALLET BALANCE</p><div className="balance">₱113,000 <span>+8.4%</span></div></div><div className="wallet-icon"><WalletCards size={23}/></div></div><div className="balance-footer"><span>₱9,500 contributed this month</span><div className="members"><i>AL</i><i>JM</i><i>+3</i></div></div></section>
      <div className="section-title"><h2>Sinking funds</h2><button className="text-btn" onClick={() => setTab('Funds')}>View all <ChevronRight size={16}/></button></div>
      <section className="fund-grid">{funds.map(f => <article className="fund-card" key={f.name}><div className="fund-top"><span className="fund-icon" style={{background:f.color}}>{f.icon}</span><button className="more" aria-label={`More options for ${f.name}`}>•••</button></div><h3>{f.name}</h3><p className="fund-amount">₱{f.amount.toLocaleString()} <span>/ ₱{f.goal.toLocaleString()}</span></p><div className="progress"><span style={{width: `${f.amount/f.goal*100}%`}}/></div><p className="fund-meta">{Math.round(f.amount/f.goal*100)}% funded</p></article>)}</section>
      <div className="section-title"><h2>Needs your approval</h2><button className="text-btn" onClick={() => notify('Opening approvals')}>See queue <ChevronRight size={16}/></button></div>
      <section className="approval-card"><div className="receipt-badge"><Receipt size={20}/></div><div className="approval-copy"><div className="approval-head"><h3>New withdrawal request</h3><span>2 of 5 approved</span></div><p>Jasmine requested <strong>₱4,800</strong> for Japan trip accommodation.</p><div className="approval-people"><span className="mini-avatars"><i>AL</i><i>KM</i></span><span>Waiting for 3 more approvals</span></div></div><button className="approve" aria-label="Approve Jasmine's withdrawal request" onClick={() => notify("Approval recorded for Jasmine's request")}><Check size={18}/></button></section>
      <div className="section-title"><h2>Quick actions</h2></div><section className="quick-grid"><button onClick={() => notify('Receipt scanner ready')}><Camera size={20}/><span>Scan receipt</span><small>AI-powered</small></button><button onClick={() => notify('New fund setup started')}><Plus size={20}/><span>New sinking fund</span><small>Set a shared goal</small></button><button onClick={() => setTab('Trips')}><MapPin size={20}/><span>Plan a trip</span><small>Fit it to your budget</small></button></section>
    </>}
    {tab !== 'Overview' && <section className="empty-view"><div className="empty-icon"><Sparkles size={26}/></div><h2>{tab}</h2><p>This workspace is ready for the next feature slice. Your shared data will sync securely across devices.</p><button className="primary" onClick={() => notify(`${tab} action added to roadmap`)}><Plus size={18}/> Add to workspace</button></section>}
    <footer><ShieldCheck size={15}/> Your group data is encrypted and synced securely</footer>{toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
