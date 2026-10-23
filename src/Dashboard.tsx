import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { BankadaLogo } from './components/common/BankadaLogo'
import { useReceiptDashboardData } from './hooks/useReceiptDashboardData'
import './dashboard.css'
import './theme-overrides.css'

type DashboardProps = {
  user: User
  onOpenWorkspace: () => void
  onSignOut: () => void
}

const formatMoney = (amount: number, currency = 'PHP') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

export function Dashboard({ user, onOpenWorkspace, onSignOut }: DashboardProps) {
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const data = useReceiptDashboardData()
  const progress = data.fund?.target ? Math.min(100, (data.total / data.fund.target) * 100) : 0

  
  const chartColors = ['#1849A9', '#38BDF8', '#FFCBA2', '#73B58A', '#9A7BC1', '#F18C72']
  const largestContributors = data.memberContributions.slice(0, 5)
  const remainingContributors = data.memberContributions.slice(5)
  const chartData = remainingContributors.length
    ? [...largestContributors, {
      userId: 'other-members',
      name: 'Other members',
      amount: remainingContributors.reduce((sum, member) => sum + member.amount, 0),
    }]
    : largestContributors
  const memberContributions = chartData.map((member, index) => ({
    ...member,
    percentage: data.total > 0 ? member.amount / data.total * 100 : 0,
    color: chartColors[index % chartColors.length],
  }))
  const personalPercentage = data.total > 0 ? data.personalTotal / data.total * 100 : 0
  const chartDescription = memberContributions.length
    ? memberContributions.map(member => `${member.name}: ${Math.round(member.percentage)}%`).join(', ')
    : 'No contribution records are available.'
  const ringRadius = 43
  const ringStroke = 10
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringGap = ringStroke + 3.5
  const ringArcsLength = ringCircumference - ringGap * memberContributions.length
  let nextArcOffset = 0
  const ringArcs = memberContributions.map(member => {
    const length = ringArcsLength * member.percentage / 100
    const arc = { ...member, length, offset: nextArcOffset }
    nextArcOffset += length + ringGap
    return arc
  })

  return <main className="ledger-dashboard">
    <header className="ledger-topbar">
      <a className="ledger-brand" href="/" aria-label="Bankada home"><BankadaLogo size="sm" showText /></a>
      <div className="ledger-topbar-right">
        <span className={`ledger-mode ${data.isDemo ? 'demo' : ''}`}><span />{data.isDemo ? 'Demo view' : 'Ledger only'}</span>
        <button className="ledger-workspace-button" type="button" onClick={onOpenWorkspace}>Manage group</button>
        <div className="ledger-profile-menu">
          <button className="ledger-avatar" type="button" aria-label="Open profile menu" aria-expanded={isDropdownOpen} onClick={() => setIsDropdownOpen(open => !open)}>
            {user.user_metadata.avatar_url ? <img className="user-avatar-img" src={user.user_metadata.avatar_url} alt="" aria-hidden="true" /> : user.user_metadata.avatar_emoji || data.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}
          </button>
          {isDropdownOpen && <div className="ledger-profile-dropdown" role="menu">
            <span className="ledger-profile-email">{user.email}</span>
            <span className="ledger-profile-divider" aria-hidden="true" />
            <button type="button" role="menuitem" onClick={() => { setIsDropdownOpen(false); setSignOutOpen(true) }}>Sign out</button>
          </div>}
        </div>
      </div>
    </header>

    <section className="ledger-intro">
      <div>
        <p className="ledger-eyebrow">YOUR GROUP LEDGER</p>
        <h1>Welcome, {data.name}</h1>
        <p className="ledger-intro-sub">Track contributions and receipts together.</p>
      </div>
      <div className="ledger-role"><i className="fa-solid fa-wallet icon-fa" aria-hidden="true" /> {data.role}</div>
    </section>

    {data.message && <p className={`ledger-message ${data.isDemo ? 'notice' : 'error'}`} role="status">{data.loading && <i className="fa-solid fa-spinner fa-spin icon-fa" aria-hidden="true" />}{data.message}</p>}

    <section className="ledger-summary-grid" aria-label="Fund summary">
      <article className="ledger-balance-card">
        <p className="ledger-balance-eyebrow">GROUP BALANCE</p>
        <strong className="ledger-balance-total">{formatMoney(data.total, data.fund?.currency)}</strong>
        <p className="ledger-balance-caption">All contributions to this fund</p>
      </article>

      <article className="ledger-goal-card">
        <div className="ledger-goal-head">
          <div><p className="ledger-card-label">ACTIVE FUND GOAL</p><h2>{data.fund?.name ?? 'No active fund selected'}</h2></div>
          <span className="ledger-icon goal"><i className="fa-solid fa-piggy-bank icon-fa" aria-hidden="true" /></span>
        </div>
        <div className="ledger-fund-totals"><div><span>Receipts accumulated</span><strong>{formatMoney(data.total, data.fund?.currency)}</strong></div><div><span>Target</span><strong>{formatMoney(data.fund?.target ?? 0, data.fund?.currency)}</strong></div></div>
        <div className="ledger-progress-track" role="progressbar" aria-label="Fund goal progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        <div className="ledger-progress-caption"><span><i className="fa-solid fa-bullseye icon-fa" aria-hidden="true" />{Math.round(progress)}% of goal</span><span>{formatMoney(Math.max(0, (data.fund?.target ?? 0) - data.total), data.fund?.currency)} to go</span></div>
      </article>

      <article className="ledger-contribution-card" aria-label="Your contributions">
        <div className="ledger-contribution-copy">
          <p className="ledger-card-label"><i className="fa-solid fa-users icon-fa" aria-hidden="true" /> YOUR CONTRIBUTIONS</p>
          <strong>{formatMoney(data.personalTotal, data.fund?.currency)}</strong>
          <small>Receipts logged under your account</small>
          <ul className="ledger-member-legend" aria-label="Group member contributions">
            {memberContributions.map(member => <li key={member.userId}>
              <span className="ledger-member-legend-name"><i style={{ backgroundColor: member.color }} />{member.name}</span>
              <span className="ledger-member-legend-value">{formatMoney(member.amount, data.fund?.currency)} ({Math.round(member.percentage)}%)</span>
            </li>)}
          </ul>
        </div>
        <div className="ledger-contribution-ring">
          <svg viewBox="0 0 112 112" role="img" aria-labelledby="contribution-chart-title contribution-chart-description">
            <title id="contribution-chart-title">Group member contribution breakdown</title>
            <desc id="contribution-chart-description">{chartDescription}</desc>
            <g transform="rotate(-90 56 56)">
              <circle className="ledger-contribution-track" cx="56" cy="56" r={ringRadius} />
              {ringArcs.map(arc => <circle
                key={arc.name}
                className="ledger-contribution-arc"
                cx="56"
                cy="56"
                r={ringRadius}
                stroke={arc.color}
                strokeDasharray={`${arc.length} ${ringCircumference - arc.length}`}
                strokeDashoffset={-arc.offset}
              />)}
            </g>
          </svg>
          <span aria-hidden="true">{Math.round(personalPercentage)}%</span>
        </div>
      </article>
    </section>

    <section className="ledger-activity" aria-labelledby="ledger-activity-title">
      <div className="ledger-activity-heading"><div><p className="ledger-eyebrow">THE PAPER TRAIL</p><h2 id="ledger-activity-title">Recent ledger activity</h2></div><button className="ledger-filter" type="button"><span>All activity</span><i className="fa-solid fa-chevron-down icon-fa" aria-hidden="true" /></button></div>
      <div className="ledger-table-wrap"><table className="ledger-table"><thead><tr><th scope="col">Contributor</th><th scope="col">Date</th><th scope="col">Receipt</th><th scope="col" className="amount-column">Amount</th></tr></thead><tbody>
        {data.loading ? <tr><td colSpan={4} className="ledger-empty">Loading the group ledger…</td></tr> : data.contributions.length ? data.contributions.map(entry => <tr key={entry.id}>
          <td><div className="contributor-cell"><span className="contributor-avatar" aria-hidden="true"><i className="fa-solid fa-user icon-fa" /></span><span><strong>{entry.contributor_name || 'Group member'}</strong><small>Deposit receipt</small></span></div></td>
          <td>{formatDate(entry.created_at)}</td>
          <td>{entry.receipt_url ? <a className={`receipt-status ${entry.receipt_verified ? 'verified' : ''}`} href={entry.receipt_url} target="_blank" rel="noreferrer">{entry.receipt_verified ? <i className="fa-solid fa-circle-check icon-fa" aria-hidden="true" /> : <i className="fa-solid fa-receipt icon-fa" aria-hidden="true" />}{entry.receipt_verified ? 'Verified' : 'View receipt'}</a> : <span className={`receipt-status ${entry.receipt_verified ? 'verified' : ''}`}>{entry.receipt_verified ? <i className="fa-solid fa-file-circle-check icon-fa" aria-hidden="true" /> : <i className="fa-solid fa-circle-question icon-fa" aria-hidden="true" />}{entry.receipt_verified ? 'Verified' : 'No attachment'}</span>}</td>
          <td className="amount-column"><strong className="ledger-amount"><i className="fa-solid fa-arrow-down icon-fa" aria-hidden="true" />{formatMoney(Number(entry.amount), data.fund?.currency)}</strong></td>
        </tr>) : <tr><td colSpan={4} className="ledger-empty"><i className="fa-solid fa-receipt icon-fa" aria-hidden="true" /><span>No receipts logged for this fund yet.</span></td></tr>}
      </tbody></table></div>
      <div className="ledger-table-footer"><span>Showing the latest {data.contributions.length} receipt entries</span><span><i className="fa-solid fa-money-bill-wave icon-fa" aria-hidden="true" /> Log receipts for transparency</span></div>
    </section>

    <footer className="ledger-footer"><span>Bankada is a receipt tracker and shared ledger. It does not store, custody, or move funds.</span></footer>

    {signOutOpen && <div className="modal-backdrop" role="presentation" onClick={() => setSignOutOpen(false)}><div className="signout-confirmation" role="dialog" aria-modal="true" aria-labelledby="ledger-signout-title" onClick={event => event.stopPropagation()}><h2 id="ledger-signout-title">Sign out of Bankada?</h2><p>You’ll need to log in again to access your dashboard.</p><div className="signout-confirmation-actions"><button type="button" className="signout-cancel" onClick={() => setSignOutOpen(false)}>Cancel</button><button type="button" className="signout-confirm" onClick={onSignOut}>Sign out</button></div></div></div>}
  </main>
}
