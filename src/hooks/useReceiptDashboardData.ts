import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export type Contribution = { id: string; contributor_name: string | null; user_id: string; amount: number; created_at: string; receipt_url: string | null; receipt_verified: boolean }
export type MemberContributionSummary = { userId: string; name: string; amount: number }
export type DashboardData = { name: string; role: string; personalTotal: number; fund: { id: string; name: string; target: number; currency: string } | null; contributions: Contribution[]; memberContributions: MemberContributionSummary[]; total: number; isDemo: boolean; loading: boolean; message: string }

const demoContributions: Contribution[] = [
  { id: 'demo-1', contributor_name: 'Kent Mendoza', user_id: 'demo-user', amount: 2500, created_at: new Date().toISOString(), receipt_url: null, receipt_verified: true },
  { id: 'demo-2', contributor_name: 'Jasmine Reyes', user_id: 'demo-member', amount: 1800, created_at: new Date(Date.now() - 86400000).toISOString(), receipt_url: null, receipt_verified: true },
  { id: 'demo-3', contributor_name: 'Alex Santos', user_id: 'demo-other', amount: 1200, created_at: new Date(Date.now() - 172800000).toISOString(), receipt_url: null, receipt_verified: false },
]
const demoData: DashboardData = { name: 'Kent Mendoza', role: 'Contributor', personalTotal: 2500, fund: { id: '', name: 'Japan trip', target: 80000, currency: 'PHP' }, contributions: demoContributions, memberContributions: [{ userId: 'demo-user', name: 'Kent Mendoza', amount: 2500 }, { userId: 'demo-member', name: 'Jasmine Reyes', amount: 1800 }, { userId: 'demo-other', name: 'Alex Santos', amount: 1200 }], total: 5500, isDemo: true, loading: false, message: 'Demo data shown. Sign in to load your group’s receipt-backed ledger.' }

type SavingsGroup = { group_id: string; group_name: string; role: string; savings_target_minor: number; balance_minor: number; currency: string }
type Receipt = { transaction_id: string; direction: 'cash_in' | 'withdrawal'; amount_minor: number; occurred_at: string; submitted_by_name: string }
type Member = { profile_id: string; display_name: string }

export function useReceiptDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({ ...demoData, loading: true, message: '' })
  useEffect(() => {
    let active = true
    async function load() {
      const supabase = getSupabaseClient()
      if (!supabase) { if (active) setData({ ...demoData, message: 'Supabase is not configured. Showing clearly labeled demo data.' }); return }
      const api = supabase as any
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const user = authData.user
      if (authError || !user) { if (active) setData({ ...demoData, message: 'Sign in to load your live group ledger. The figures below are demo data.' }); return }
      const name = String(user.user_metadata?.full_name ?? user.email ?? 'Bankada member')
      const { data: groups, error: groupError } = await api.rpc('list_my_group_savings')
      const group = (groups?.[0] ?? null) as SavingsGroup | null
      if (groupError || !group) { if (active) setData({ ...demoData, name, role: 'Member', isDemo: false, contributions: [], memberContributions: [], total: 0, personalTotal: 0, fund: null, message: groupError?.message ?? 'No group savings fund is linked to this account yet.' }); return }
      const [{ data: history, error: historyError }, { data: members }] = await Promise.all([api.rpc('list_group_receipt_history', { p_group_id: group.group_id, p_limit: 30 }), api.rpc('list_barkada_members', { p_group_id: group.group_id })])
      const receipts = (history ?? []) as Receipt[]
      const memberIds = new Map(((members ?? []) as Member[]).map(member => [member.display_name, member.profile_id]))
      const totals = new Map<string, MemberContributionSummary>()
      let personalTotal = 0
      for (const receipt of receipts) {
        if (receipt.direction !== 'cash_in') continue
        const amount = Number(receipt.amount_minor) / 100
        const contributor = receipt.submitted_by_name || 'Group member'
        const existing = totals.get(contributor)
        if (existing) existing.amount += amount
        else totals.set(contributor, { userId: memberIds.get(contributor) ?? contributor, name: contributor, amount })
        if (contributor === name) personalTotal += amount
      }
      const contributions: Contribution[] = receipts.map(receipt => ({ id: receipt.transaction_id, contributor_name: receipt.submitted_by_name, user_id: memberIds.get(receipt.submitted_by_name) ?? receipt.submitted_by_name, amount: (receipt.direction === 'withdrawal' ? -1 : 1) * Number(receipt.amount_minor) / 100, created_at: receipt.occurred_at, receipt_url: null, receipt_verified: true }))
      if (active) setData({ name, role: group.role ?? 'Member', personalTotal, fund: { id: group.group_id, name: group.group_name, target: Number(group.savings_target_minor) / 100, currency: group.currency ?? 'PHP' }, contributions, memberContributions: [...totals.values()].sort((left, right) => right.amount - left.amount), total: Number(group.balance_minor) / 100, isDemo: false, loading: false, message: historyError ? `Group loaded, but receipt history could not be loaded: ${historyError.message}` : '' })
    }
    void load().catch(error => { if (active) setData({ ...demoData, message: error instanceof Error ? error.message : 'Could not load dashboard data.' }) })
    return () => { active = false }
  }, [])
  return data
}
