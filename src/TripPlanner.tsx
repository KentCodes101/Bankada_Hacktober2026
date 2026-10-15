import { FormEvent, useState } from 'react'
import { ArrowUpRight, LoaderCircle, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import './trip-planner.css'

type Cost = { amountMinor: number; notes: string }
type Itinerary = {
  title: string; destination: string; durationDays: number; summary: string
  transportation: Cost; accommodation: Cost; food: Cost; activities: Cost; totalMinor: number
}
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type PlannerResponse = { assistantMessage: string; options: Itinerary[]; budget: { amountMinor: number; currency: string } }

const categories: [keyof Pick<Itinerary, 'transportation' | 'accommodation' | 'food' | 'activities'>, string][] = [
  ['transportation', 'Transportation'], ['accommodation', 'Accommodation'], ['food', 'Food'], ['activities', 'Activities'],
]

/** Budget-aware trip planning UI. The fund ID and access token come from the authenticated app shell. */
export function TripPlanner({ fundId }: { fundId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reply, setReply] = useState<PlannerResponse | null>(null)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: { preventDefault: () => void }, cheaper = false) {
    event.preventDefault()
    if (pending || (!cheaper && !input.trim())) return
    const next = cheaper
      ? [...messages, { role: 'user' as const, content: 'Please regenerate the three suggestions with lower estimated total costs.' }]
      : [...messages, { role: 'user' as const, content: input.trim() }]
    setMessages(next)
    setInput('')
    setError('')
    setPending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        // Keep the browser payload deliberately limited to conversational input
        // and fund identity. The server obtains budget facts from Supabase.
        body: JSON.stringify({ ...(fundId ? { fundId } : {}), messages: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Trip planning failed. Please try again.')
      const result = data as PlannerResponse
      setReply(result)
      setMessages([...next, { role: 'assistant', content: result.assistantMessage }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the trip planner.')
    } finally {
      setPending(false)
    }
  }

  const money = (minor: number) => {
    const currency = reply?.budget.currency ?? 'PHP'
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency })
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits
    return formatter.format(minor / (10 ** fractionDigits))
  }

  return <section className="planner-page">
    <header className="planner-heading">
      <div className="planner-icon"><Sparkles size={21}/></div>
      <div><p className="eyebrow">FUND-AWARE TRIP PLANNING</p><h2>Plan a trip together</h2>
        <p>Explore three itinerary ideas priced against your group fund.</p></div>
    </header>

    {!fundId && <div className="planner-setup" role="status">
      No fund is selected. The server can use VITE_TRIP_FUND_ID for local development.
      {' '}Budget values always come from the server-side funds query.
    </div>}

    <div className="planner-conversation" aria-live="polite">
      {!messages.length && <div className="planner-empty"><MapPin size={22}/><strong>Where should your barkada go?</strong>
        <span>Try: “Plan a 4-day beach trip for five people in December.”</span></div>}
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`planner-message ${message.role}`}>
        {message.content}
      </div>)}
    </div>

    {reply && <div className="itinerary-grid">
      {reply.options.map((option, index) => {
        const fits = option.totalMinor < reply.budget.amountMinor
        return <article className="itinerary-card" key={`${option.destination}-${index}`}>
          <div className="itinerary-card-heading"><div><span className="option-label">OPTION 0{index + 1}</span>
            <h3>{option.title}</h3><p><MapPin size={13}/>{option.destination} · {option.durationDays} days</p></div>
            <span className={`budget-badge ${fits ? 'fits' : 'over'}`}>{fits ? 'Fits budget' : 'Over budget'}</span>
          </div>
          <p className="itinerary-summary">{option.summary}</p>
          <dl className="cost-list">{categories.map(([key, label]) => <div key={key}>
            <dt>{label}<small>{option[key].notes}</small></dt><dd>{money(option[key].amountMinor)}</dd>
          </div>)}</dl>
          <div className="itinerary-total"><span>Estimated total</span><strong>{money(option.totalMinor)}</strong></div>
          <p className="budget-caption">Fund limit: {money(reply.budget.amountMinor)} · Estimates, not live quotes</p>
        </article>
      })}
    </div>}

    {error && <p className="planner-error" role="alert">{error}</p>}
    <form className="planner-composer" onSubmit={submit}>
      <input value={input} onChange={event => setInput(event.target.value)} maxLength={4000}
        placeholder="Tell us where, when, and who’s going…" aria-label="Message the trip planner" disabled={pending}/>
      <button className="planner-send" disabled={pending || !input.trim()} aria-label="Send message">
        {pending ? <LoaderCircle className="spin" size={18}/> : <ArrowUpRight size={18}/>}
      </button>
    </form>
    <div className="planner-actions"><span>Costs are estimates in the fund’s currency.</span>
      <button className="planner-cheaper" disabled={pending || !reply} onClick={event => void submit(event, true)}>
        <RefreshCw size={14}/> Regenerate cheaper options
      </button>
    </div>
  </section>
}
