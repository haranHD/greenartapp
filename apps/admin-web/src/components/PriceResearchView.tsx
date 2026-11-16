import React, { useEffect, useState } from 'react';
type FormEvent<T> = { preventDefault(): void; currentTarget: T };
import { api, PriceResearchItem } from '../services/api';
import './priceResearch.css';

const roadOptions = ['Main Road / Highway (40ft-100ft)', 'Standard Layout Road (24ft-30ft)', 'Interior / Village Lane (<20ft)'];
const money = (n: number | null) => n == null ? '—' : `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
const dateInput = (days = 0) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function PriceResearchView({ adminKey }: { adminKey: string }) {
  const [items, setItems] = useState<PriceResearchItem[]>([]);
  const [providers, setProviders] = useState<{ provider: string; configured: boolean }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rows, status] = await Promise.all([
        api.priceResearch<PriceResearchItem[]>(),
        api.priceResearch<{ provider: string; configured: boolean }[]>('providers'),
      ]);
      setItems(rows); setProviders(status);
    } catch (e: any) { setError(e.message || 'Could not load price research.'); }
    finally { setLoading(false); }
  }, [adminKey]);
  useEffect(() => { void load(); }, [load]);
  const run = async (path: string, data: unknown) => {
    setBusy(true); setError('');
    try {
      const updated = await api.priceResearch<PriceResearchItem>(path, data);
      setSelected(updated.id); await load();
    } catch (e: any) { setError(e.message || 'Could not save. Reload before retrying.'); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await run('', { locality: f.get('locality'), district: f.get('district'), latitude: Number(f.get('lat')),
      longitude: Number(f.get('lng')), landUsage: Number(f.get('usage')), coverageRadiusMeters: Number(f.get('radius')),
      roadAccess: f.get('road'), context: f.get('context') });
  };
  const item = items.find(x => x.id === selected);
  return <div className="price-workspace">
    <div className="price-banner">
      <span className="price-eyebrow">PRICING WORKSPACE</span>
      <h2>Research. Cross-check. Publish.</h2>
      <p>Compare AI proposals, record the local broker’s findings, and approve a range your customers can trace.</p>
      <div className="price-provider-row">{providers.map(p => <span key={p.provider} className={p.configured ? 'price-ready' : ''}>{p.provider} · {p.configured ? 'Configured' : 'Not configured'}</span>)}</div>
    </div>
    {error && <div className="price-error" role="alert">{error} <button type="button" onClick={() => void load()} disabled={busy}>Reload</button></div>}
    <div className="price-layout">
      <section className="price-panel">
        <h3>New price research</h3><p>One exercise can contain up to three AI proposals. They do not count as three sale observations.</p>
        <form onSubmit={create} className="price-form">
          <label>Locality<input name="locality" required maxLength={150} /></label>
          <label>District<input name="district" required maxLength={150} /></label>
          <div className="price-fields"><label>Latitude<input name="lat" type="number" step="any" min="6" max="38" required /></label><label>Longitude<input name="lng" type="number" step="any" min="68" max="98" required /></label></div>
          <label>Land type<select name="usage"><option value="1">Residential</option><option value="2">Commercial</option><option value="3">Agricultural wet</option><option value="4">Agricultural dry</option><option value="5">Industrial</option><option value="6">Mixed use</option></select></label>
          <label>Road access<select name="road">{roadOptions.map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Applies within (metres)<input name="radius" type="number" min="50" max="1000" defaultValue="500" required /></label>
          <label>Property context<textarea name="context" maxLength={4000} placeholder="Land characteristics, surrounding amenities, and reference information. Exclude personal data." /></label>
          <button disabled={busy} className="price-primary">Create research</button>
        </form>
      </section>
      <section className="price-panel">
        <div className="price-heading"><h3>Research & reviews</h3><button disabled={busy || loading} onClick={() => void load()}>Refresh</button></div>
        {loading ? <p role="status">Loading research…</p> : items.length === 0 ? <p>No research yet. Create the first locality record to begin.</p> : <label>Choose research<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a locality</option>{items.map(x => <option key={x.id} value={x.id}>{x.locality} · {x.district} · {x.status}</option>)}</select></label>}
        {item && <ResearchReview key={`${item.id}:${item.version}`} item={item} busy={busy} canResearch={providers.some(x => x.configured)} run={run} />}
      </section>
    </div>
  </div>;
}

function ResearchReview({ item, busy, canResearch, run }: { item: PriceResearchItem; busy: boolean; canResearch: boolean; run: (path: string, data: unknown) => Promise<void> }) {
  const [low, setLow] = useState(item.lowPerCent == null ? '' : String(item.lowPerCent / 100000));
  const [high, setHigh] = useState(item.highPerCent == null ? '' : String(item.highPerCent / 100000));
  const [notes, setNotes] = useState('');
  const [expiry, setExpiry] = useState(dateInput(30));
  const [action, setAction] = useState('Approve');
  const proposals = item.proposals.filter(p => p.status === 'Proposed' && p.lowPerCent != null && p.highPerCent != null);
  const rates = <div className="price-fields"><label>Low (₹ lakh / cent)<input type="number" step="0.00001" min="0.00001" max="10000" value={low} onChange={e => setLow(e.target.value)} required /></label><label>High (₹ lakh / cent)<input type="number" step="0.00001" min={low || '0.00001'} max="10000" value={high} onChange={e => setHigh(e.target.value)} required /></label></div>;
  const brokerReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    void run(`${item.id}/broker-review`, { version: item.version, brokerName: f.get('broker'), evidence: f.get('evidence'), observationCount: Number(f.get('count')), lowPerCent: Number(low) * 100000, highPerCent: Number(high) * 100000, observedAtUtc: new Date(`${f.get('date')}T00:00:00Z`).toISOString() });
  };
  const decision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action, lowPerCent: Number(low) * 100000, highPerCent: Number(high) * 100000, validUntilUtc: new Date(`${expiry}T23:59:59Z`).toISOString(), notes });
  };
  return <div className="price-review">
    <span className={`price-status price-status-${item.status.toLowerCase()}`}>{item.status}</span>
    <h3>{item.locality}, {item.district}</h3><p>{item.roadAccess} · {item.coverageRadiusMeters} m coverage<br />{item.latitude}, {item.longitude}</p>
    {item.context && <p className="price-preserve">{item.context}</p>}
    <h4>AI proposals <small>Unvalidated research</small></h4>
    {proposals.length > 0 && <div className="price-proposal"><strong>Combined proposal spread</strong><b>{money(Math.min(...proposals.map(p => p.lowPerCent!)))} – {money(Math.max(...proposals.map(p => p.highPerCent!)))} / cent</b><p>Lowest to highest proposal. This is one research exercise; the broker must check and supply the final range.</p></div>}
    {item.proposals.length === 0 && <p>No proposals yet. You can record broker evidence while API configuration is pending.</p>}
    {item.proposals.map((p, i) => <article className="price-proposal" key={i}>
      <strong>{p.provider}</strong><span>{p.model} · {p.status}</span>
      {p.lowPerCent != null && <b>{money(p.lowPerCent)} – {money(p.highPerCent)} / cent</b>}
      <p className="price-preserve">{p.reasoning}</p>
      {p.sources.length > 0 && <details><summary>Model-supplied links · broker must verify</summary>{p.sources.map((s, j) => <a href={s} key={j} target="_blank" rel="noopener noreferrer">{s}</a>)}</details>}
      <small>{new Date(p.generatedAtUtc).toLocaleString()}</small>
    </article>)}
    {item.status === 'Draft' && <><p className="price-note">Run research contacts configured AI providers and may incur usage charges. No web search or automatic retries. Saved proposals are retained. Create a new exercise to run research again.</p><button disabled={busy || !canResearch || item.proposals.length > 0} onClick={() => void run(`${item.id}/research`, { version: item.version })}>{busy ? 'Working…' : 'Run configured AI providers'}</button></>}
    {item.status === 'Researching' && <><p>Research is running or was interrupted. Refresh first. After two minutes you can recover the draft; check provider usage before running again.</p><button disabled={busy} onClick={() => void run(`${item.id}/recover`, { version: item.version })}>Recover interrupted research</button></>}
    {item.status === 'Draft' && <form className="price-form" onSubmit={brokerReview}><h4>Record broker cross-check</h4>
      <label>Broker name (internal)<input name="broker" maxLength={150} required /></label>
      <label>Observation date<input name="date" type="date" min={dateInput(-89)} max={dateInput()} defaultValue={dateInput()} required /></label>
      <label>Independent local observations<input name="count" type="number" min="1" max="10000" required /></label>
      <label>Supporting evidence (internal)<textarea name="evidence" minLength={20} maxLength={6000} required placeholder="Record the cross-check method, locality, comparable property details, dates and supporting references. AI answers do not count as observations." /></label>
      {rates}<button disabled={busy} className="price-primary">Save broker review</button>
    </form>}
    {item.status !== 'Draft' && item.status !== 'Researching' && <div className="price-broker"><h4>Broker cross-check</h4><p>{item.brokerName || 'No broker review'} · {item.observationCount} observations</p>{item.brokerLowPerCent != null && <strong>{money(item.brokerLowPerCent)} – {money(item.brokerHighPerCent)} / cent</strong>}<p className="price-preserve">{item.brokerEvidence}</p></div>}
    {item.status === 'BrokerReviewed' && <form className="price-form" onSubmit={decision}><h4>Final publishing decision</h4>
      <label>Decision<select value={action} onChange={e => setAction(e.target.value)}><option>Approve</option><option>Reject</option></select></label>
      {action === 'Approve' && <>{rates}<label>Valid until<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} min={dateInput()} max={item.brokerReviewedAtUtc ? new Date(new Date(item.brokerReviewedAtUtc).getTime() + 89 * 86400000).toISOString().slice(0, 10) : dateInput(89)} required /></label></>}
      <label>Decision notes<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} placeholder="Explain approval and any changes to the broker range, or the reason for rejection." /></label>
      <button disabled={busy} className="price-primary">{action === 'Approve' ? 'Approve & publish range' : 'Reject research'}</button>
    </form>}
    {item.status === 'Approved' && <div className="price-published"><h4>Published broker-reviewed range</h4><strong>{money(item.lowPerCent)} – {money(item.highPerCent)} / cent</strong><p>Valid until {item.validUntilUtc && new Date(item.validUntilUtc).toLocaleDateString()}. Expired records are automatically excluded from customer results.</p><form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'Withdraw', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Withdrawal reason<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} /></label><button disabled={busy}>Withdraw published range</button></form></div>}
    {item.reviewNotes && <p className="price-preserve"><strong>Decision notes:</strong> {item.reviewNotes}</p>}
    {item.status === 'Draft' && <form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'Reject', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Reject this draft<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} placeholder="Reason for rejection" /></label><button disabled={busy}>Reject draft</button></form>}
  </div>;
}
