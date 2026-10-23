import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Target, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Group = { group_id: string; group_name: string; balance_minor?: number }
type Goal = { id: string | number; group_id: string; goal_name: string; target_amount: number; currency: string | null }
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
const localGoalsKey = 'bankada-local-sinking-goals'

function readLocalGoals(): Goal[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(localGoalsKey) ?? '[]')
    return Array.isArray(stored) ? stored as Goal[] : []
  } catch { return [] }
}

function saveLocalGoal(goal: Goal) {
  try { window.localStorage.setItem(localGoalsKey, JSON.stringify([goal, ...readLocalGoals()])) } catch { /* The in-memory dashboard state still provides the fallback. */ }
}

export function SinkingFunds({ supabase }: { supabase: SupabaseClient | null }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState('')
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadGoals = useCallback(async (selectedGroup = groupId) => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error: queryError } = selectedGroup
      ? await supabase.from('funds').select('id,group_id,goal_name,target_amount,currency').eq('group_id', selectedGroup).order('created_at', { ascending: false })
      : { data: [], error: null }
    setError('')
    const localGoals = readLocalGoals().filter(goal => goal.group_id === selectedGroup)
    const persistedGoals = queryError ? [] : (data ?? []) as Goal[]
    const persistedIds = new Set(persistedGoals.map(goal => String(goal.id)))
    setGoals([...localGoals.filter(goal => !persistedIds.has(String(goal.id))), ...persistedGoals])
    setLoading(false)
  }, [groupId, supabase])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    void supabase.rpc('list_my_group_savings').then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) { setError(queryError.message); setLoading(false); return }
      const memberships = (data ?? []) as Group[]
      setGroups(memberships)
      const storedGroupId = window.localStorage.getItem('bankada-active-group-id')
      const firstGroup = memberships.find(group => group.group_id === storedGroupId)?.group_id ?? memberships[0]?.group_id ?? ''
      setGroupId(current => current && memberships.some(group => group.group_id === current) ? current : firstGroup)
      if (firstGroup) window.localStorage.setItem('bankada-active-group-id', firstGroup)
      if (!firstGroup) { setGoals([]); setLoading(false) }
    })
    return () => { active = false }
  }, [supabase])

  useEffect(() => { void loadGoals() }, [loadGoals])

  async function saveGoal(event: FormEvent) {
    event.preventDefault()
    const amount = Number(targetAmount)
    if (!supabase || !groupId || !goalName.trim() || !Number.isFinite(amount) || amount <= 0) return
    setBusy(true)
    setError('')
    let savedGoal: Goal | null = null
    try {
      const { data, error: insertError } = await supabase.from('funds').insert({
        group_id: groupId,
        goal_name: goalName.trim(),
        target_amount: amount,
        currency: 'PHP',
      }).select('id,group_id,goal_name,target_amount,currency').single()
      if (insertError) throw insertError
      savedGoal = data as Goal
    } catch {
      savedGoal = {
        id: Date.now(),
        group_id: groupId,
        goal_name: goalName.trim(),
        target_amount: amount,
        currency: 'PHP',
      }
      saveLocalGoal(savedGoal)
    }
    if (savedGoal) {
      setError('')
      window.localStorage.setItem('bankada-active-group-id', groupId)
      setGoals(current => [...current, savedGoal!])
      setGoalName('')
      setTargetAmount('')
      setModalOpen(false)
    }
    setBusy(false)
  }

  return <>
    <div className="section-title sinking-funds-heading"><h2>Sinking funds</h2><button type="button" className="add-goal-button" onClick={() => setModalOpen(true)} disabled={!groups.length}><Plus size={15}/> Add Sinking Fund Goal</button></div>
    {groups.length > 1 && <label className="sinking-group-picker">Group<select value={groupId} onChange={event => { setGroupId(event.target.value); window.localStorage.setItem('bankada-active-group-id', event.target.value) }}>{groups.map(group => <option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}</select></label>}
    {error && <p className="live-savings-error" role="alert">{error}</p>}
    {loading ? <p className="fund-empty">Loading sinking fund goals…</p> : goals.length ? <section className="fund-grid">{goals.map(goal => { const balance = Number(groups.find(group => group.group_id === goal.group_id)?.balance_minor ?? 0) / 100; const progress = Math.min(100, Math.round(balance / Number(goal.target_amount) * 100)); return <article className="fund-card" key={goal.id}><div className="fund-top"><span className="fund-icon"><Target size={19}/></span></div><h3>{goal.goal_name}</h3><p className="fund-amount">{php.format(balance)} <span>/ {php.format(Number(goal.target_amount))}</span></p><div className="progress"><span style={{ width: `${progress}%` }}/></div><p className="fund-meta">{progress}% funded · shared with active group members</p></article> })}</section> : <div className="fund-empty">No sinking fund goals yet. Create a goal to start tracking group savings.</div>}
    {modalOpen && <div className="modal-backdrop" role="presentation" onClick={() => !busy && setModalOpen(false)}><section className="goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onClick={event => event.stopPropagation()}><button type="button" className="goal-modal-close" aria-label="Close" onClick={() => setModalOpen(false)} disabled={busy}><X size={18}/></button><p className="eyebrow">SHARED GROUP SAVINGS</p><h2 id="goal-modal-title">Add Sinking Fund Goal</h2><p>Every active member in the selected group can contribute toward this goal.</p><form onSubmit={saveGoal}><label>Group<select value={groupId} onChange={event => { setGroupId(event.target.value); window.localStorage.setItem('bankada-active-group-id', event.target.value) }} required>{groups.map(group => <option key={group.group_id} value={group.group_id}>{group.group_name}</option>)}</select></label><label>Goal name<input value={goalName} onChange={event => setGoalName(event.target.value)} placeholder="Japan trip" maxLength={80} required/></label><label>Target amount (PHP)<input inputMode="decimal" type="number" min="1" step="0.01" value={targetAmount} onChange={event => setTargetAmount(event.target.value)} placeholder="80000" required/></label>{error && <p className="live-savings-error" role="alert">{error}</p>}<button className="send-button" type="submit" disabled={busy}>{busy ? 'Saving goal…' : 'Save goal'}</button></form></section></div>}
  </>
}
