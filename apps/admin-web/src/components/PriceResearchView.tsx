import React, { useEffect, useState } from 'react';
type FormEvent<T> = { preventDefault(): void; currentTarget: T };
import { api, PriceResearchItem } from '../services/api';
import './priceResearch.css';
import { MarketResearchEvidenceView } from './MarketResearchEvidenceView';

const roadOptions = ['Main Road / Highway (40ft-100ft)', 'Standard Layout Road (24ft-30ft)', 'Interior / Village Lane (<20ft)'];
const money = (n: number | null) => n == null ? '—' : `₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
const dateInput = (days = 0) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function PriceResearchView({ adminKey }: { adminKey: string }) {
  const [filters, setFilters] = useState('');
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
        api.priceResearch<PriceResearchItem[]>(filters ? `?${filters}` : ''),
        api.priceResearch<{ provider: string; configured: boolean }[]>('providers'),
      ]);
      setItems(rows); setProviders(status);
    } catch (e: any) { setError(e.message || 'Could not load price research.'); }
    finally { setLoading(false); }
  }, [adminKey, filters]);
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
      roadAccess: f.get('road'), context: f.get('context'), taluk: f.get('taluk'), area: Number(f.get('area')), areaUnit: f.get('areaUnit') });
  };
  const item = items.find(x => x.id === selected);
  return <div className="price-workspace">
    <div className="price-banner">
      <span className="price-eyebrow">PRICING WORKSPACE</span>
      <h2>Market Price Verification</h2>
      <p>Inspect grounded Gemini asking-price research, its separate evidence review, and independent broker opinions before making an auditable decision.</p>
      <div className="price-provider-row">{providers.map(p => <span key={p.provider} className={p.configured ? 'price-ready' : ''}>{p.provider} · {p.configured ? 'Configured' : 'Not configured'}</span>)}</div>
    </div>
    {error && <div className="price-error" role="alert">{error} <button type="button" onClick={() => void load()} disabled={busy}>Reload</button></div>}
    <div className="price-layout">
      <section className="price-panel">
        <h3>New price research</h3><p>Only adequately supported asking-price research that passes deterministic checks and a separate AI evidence review can show a provisional range. Grounding and review can use API credits. Neither AI nor broker opinions count as completed sales.</p>
        <form onSubmit={create} className="price-form">
          <label>Locality<input name="locality" required maxLength={150} /></label>
          <label>District<input name="district" required maxLength={150} /></label><label>Taluk<input name="taluk" maxLength={150} /></label>
          <div className="price-fields"><label>Land area<input name="area" type="number" step="0.0001" min="0.0001" max="100000000" required /></label><label>Area unit<select name="areaUnit"><option>Cent</option><option>SqFt</option><option>Acre</option><option>Ground</option><option>Sqm</option></select></label></div>
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
        <form className="price-form market-filters" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const q = new URLSearchParams(); f.forEach((v, k) => { if (String(v).trim()) q.set(k, String(v)); }); setFilters(q.toString()); }}>
          <div className="price-fields"><label>District<input name="district" /></label><label>Taluk<input name="taluk" /></label><label>Village/locality<input name="village" /></label></div>
          <div className="price-fields"><label>Land category<select name="landCategory"><option value="">All</option><option value="1">Residential</option><option value="2">Commercial</option><option value="3">Agricultural wet</option><option value="4">Agricultural dry</option><option value="5">Industrial</option><option value="6">Mixed use</option></select></label>
          <label>Research status<select name="researchStatus"><option value="">All</option>{['NotStarted','PassedEvidenceReview','NeedsManualReview','InsufficientEvidence','GroundingUnavailable','ProviderError','Timeout'].map(v => <option key={v}>{v}</option>)}</select></label><label>Broker review<select name="brokerStatus"><option value="">All</option><option>Pending</option><option>Reviewed</option></select></label></div>
          <div className="price-fields"><label>From<input name="from" type="date" /></label><label>To<input name="to" type="date" /></label></div>
          <div className="price-heading"><button type="submit">Apply filters</button><button type="reset" onClick={() => setFilters('')}>Clear filters</button></div>
        </form>
        {loading ? <p role="status">Loading research…</p> : items.length === 0 ? <p>No matching research. Create a complete request or clear the filters.</p> : <div className="market-queue-scroll"><table className="market-queue"><thead><tr><th>Location / category</th><th>Asking range / cent</th><th>Sources / date</th><th>AI review</th><th>Broker / decision</th><th>Inspect</th></tr></thead><tbody>{items.map(x => <tr key={x.id}><td>{x.locality}, {x.district}<br />{x.taluk} · {['','Residential','Commercial','Agricultural wet','Agricultural dry','Industrial','Mixed use'][x.landUsage]}</td><td>{money(x.research?.typicalPerCent ?? null)} typical<br />{money(x.research?.lowPerCent ?? null)} – {money(x.research?.highPerCent ?? null)}</td><td>{x.research?.sourceCount ?? 0} · {(x.research?.researchTimestampUtc || x.createdAtUtc) ? new Date(x.research?.researchTimestampUtc || x.createdAtUtc!).toLocaleDateString() : 'Date unavailable'}</td><td>{x.aiReviewStatus || 'NotReviewed'}</td><td>{x.brokerReviewedAtUtc ? 'Broker recorded' : 'Broker pending'}<br />{x.status}</td><td><button type="button" onClick={() => setSelected(x.id)}>Inspect research</button></td></tr>)}</tbody></table></div>}

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
    void run(`${item.id}/broker-review`, { version: item.version, brokerName: f.get('broker'), evidence: f.get('evidence'), observationCount: Number(f.get('count')), lowPerCent: Number(low) * 100000, highPerCent: Number(high) * 100000, observedAtUtc: new Date(`${f.get('date')}T00:00:00Z`).toISOString(), typicalPerCent: Number(f.get('typical')) * 100000, brokerId: f.get('brokerId'), contactReference: f.get('contact'), brokerLocality: f.get('brokerLocality'), familiarity: f.get('familiarity'), documentReference: f.get('document'), evidenceType: 'BrokerMarketOpinion', landCategory: item.landUsage });
  };
  const decision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action, lowPerCent: Number(low) * 100000, highPerCent: Number(high) * 100000, validUntilUtc: new Date(`${expiry}T23:59:59Z`).toISOString(), notes });
  };
  return <div className="price-review">
    <span className={`price-status price-status-${item.status.toLowerCase()}`}>{item.status}</span>
    <h3>{item.locality}, {item.district}</h3><p>{item.roadAccess} · {item.coverageRadiusMeters} m coverage<br />{item.latitude}, {item.longitude}</p>
    {item.context && <p className="price-preserve">{item.context}</p>}
    <section className="price-broker"><h4>Client-authorized source references</h4>
      <p>Gemini reads these authorized references. Google Search grounding is not used to collect the historical database. Public availability alone does not grant storage or redistribution rights.</p>
      {item.authorizedSources?.map((source, i) => <details key={i}><summary>{source.name} · {source.url}</summary><p>Internal rights reference: {source.rightsReference}<br />Registered by {source.registeredBy} {source.registeredAtUtc && new Date(source.registeredAtUtc).toLocaleString()}</p></details>)}
      {item.status !== 'Researching' && <form className="price-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const urls = String(f.get('sources') || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        const sources = urls.map(url => ({ name: (() => { try { return new URL(url).hostname; } catch { return 'Invalid source'; } })(), url, rightsReference: String(f.get('rights') || ''), retrievalAndStorageAuthorized: f.get('retrieval') === 'on', publicDisplayAuthorized: f.get('display') === 'on' }));
        void run(`${item.id}/sources`, { version: item.version, sources }); }}>
        <label>3–8 authorized HTTPS source URLs · one per line<textarea name="sources" rows={4} required placeholder="Public references from your client or licensed source agreement. No credentials or signed private URLs." /></label>
        <label>Permission/contract reference · internal<textarea name="rights" minLength={20} maxLength={1000} required placeholder="Record the owner/provider permission covering retrieval, storage, historical analysis and evidence display." /></label>
        <label><input name="retrieval" type="checkbox" required /> Client has permission to retrieve and store this source data.</label>
        <label><input name="display" type="checkbox" required /> Client has permission to display the source observations and references.</label>
        <button disabled={busy}>Register authorized references</button><small>Analysed records are preserved; registering new references creates a follow-up exercise.</small>
      </form>}
    </section>
    <MarketResearchEvidenceView item={item} />
    <details><summary>Original model proposal history · legacy entries may be ungrounded</summary>
    <h4>Saved model output</h4>
    {proposals.length > 0 && <div className="price-proposal"><strong>Combined proposal spread</strong><b>{money(Math.min(...proposals.map(p => p.lowPerCent!)))} – {money(Math.max(...proposals.map(p => p.highPerCent!)))} / cent</b><p>Lowest to highest proposal. This is one research exercise; the broker must check and supply the final range.</p></div>}
    {item.proposals.length === 0 && <p>No proposals yet. You can record broker evidence while API configuration is pending.</p>}
    {item.proposals.map((p, i) => <article className="price-proposal" key={i}>
      <strong>{p.provider}</strong><span>{p.model} · {p.status}</span>
      {p.lowPerCent != null && <b>{money(p.lowPerCent)} – {money(p.highPerCent)} / cent</b>}
      <p className="price-preserve">{p.reasoning}</p>
      {p.sources.length > 0 && <details><summary>Model-supplied links · broker must verify</summary>{p.sources.map((s, j) => <a href={s} key={j} target="_blank" rel="noopener noreferrer">{s}</a>)}</details>}
      <small>{new Date(p.generatedAtUtc).toLocaleString()}</small>
    </article>)}
    </details>
    {item.status === 'Draft' && <><p className="price-note">Research extracts from client-authorized sources and, only when enough evidence survives source checks, runs a separate Gemini consistency review. These model calls may incur charges. Without adequate authorized sources, no model call is made. No automatic retries. Original results are retained.</p><button disabled={busy || !canResearch || item.proposals.length > 0} onClick={() => void run(`${item.id}/research`, { version: item.version })}>{busy ? 'Working…' : 'Analyze authorized sources with Gemini'}</button></>}
    {item.status === 'Researching' && <><p>Research is running or was interrupted. Refresh first. After two minutes you can recover the draft; check provider usage before running again.</p><button disabled={busy} onClick={() => void run(`${item.id}/recover`, { version: item.version })}>Recover interrupted research</button></>}
    {['Draft','NeedsCorrection','InsufficientEvidence'].includes(item.status) && <form className="price-form" onSubmit={brokerReview}><h4>Record broker cross-check</h4>
      <label>Broker name (internal)<input name="broker" maxLength={150} required /></label><label>Broker ID/reference<input name="brokerId" maxLength={150} /></label><label>Contact reference · restricted<input name="contact" maxLength={250} /></label><label>Broker locality<input name="brokerLocality" defaultValue={item.locality} maxLength={150} required /></label><label>Broker familiarity<select name="familiarity"><option>NotProvided</option><option>Low</option><option>Medium</option><option>High</option></select></label><label>Existing supporting document reference (optional)<input name="document" maxLength={1000} /></label><p>Classification: Broker Market Opinion. Collect the broker’s independent assessment before discussing the AI price.</p>
      <label>Observation date<input name="date" type="date" min={dateInput(-89)} max={dateInput()} defaultValue={dateInput()} required /></label>
      <label>Independent local observations<input name="count" type="number" min="1" max="10000" required /></label>
      <label>Supporting evidence (internal)<textarea name="evidence" minLength={20} maxLength={6000} required placeholder="Record the cross-check method, locality, comparable property details, dates and supporting references. AI answers do not count as observations." /></label>
      {rates}<label>Typical broker rate (₹ lakh / cent)<input name="typical" type="number" min={low || "0.00001"} max={high || "10000"} step="0.00001" required /></label><button disabled={busy} className="price-primary">Save broker review</button>
    </form>}
    {item.status !== 'Draft' && item.status !== 'Researching' && <div className="price-broker"><h4>Broker cross-check</h4><p>{item.brokerName || 'No broker review'} · {item.observationCount} observations</p>{item.brokerLowPerCent != null && <strong>{money(item.brokerLowPerCent)} – {money(item.brokerHighPerCent)} / cent</strong>}<p className="price-preserve">{item.brokerEvidence}</p></div>}
    {item.status === 'BrokerReviewed' && <form className="price-form" onSubmit={decision}><h4>Final publishing decision</h4>
      <label>Decision<select value={action} onChange={e => setAction(e.target.value)}><option>Approve</option><option>Reject</option></select></label>
      {action === 'Approve' && <>{rates}<label>Valid until<input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} min={dateInput()} max={item.brokerReviewedAtUtc ? new Date(new Date(item.brokerReviewedAtUtc).getTime() + 89 * 86400000).toISOString().slice(0, 10) : dateInput(89)} required /></label></>}
      <label>Decision notes<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} placeholder="Explain approval and any changes to the broker range, or the reason for rejection." /></label>
      <button disabled={busy} className="price-primary">{action === 'Approve' ? 'Approve & publish range' : 'Reject research'}</button>
    </form>}
    {item.status === 'Approved' && <div className="price-published"><h4>Published Broker-Reviewed Market Opinion</h4><strong>{money(item.lowPerCent)} – {money(item.highPerCent)} / cent</strong><p>Valid until {item.validUntilUtc && new Date(item.validUntilUtc).toLocaleDateString()}. Expired records are automatically excluded from customer results.</p><form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'Withdraw', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Withdrawal reason<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} /></label><button disabled={busy}>Withdraw published range</button></form></div>}
    {item.status !== 'Researching' && item.inputArea && <button disabled={busy || !canResearch} onClick={() => void run(`${item.id}/refresh`, { version: item.version })}>Refresh evidence research · uses API credits and preserves original</button>}
    {['Draft','BrokerReviewed','InsufficientEvidence'].includes(item.status) && <form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'RequestCorrection', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Request correction / further verification<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} /></label><button disabled={busy}>Request correction</button></form>}
    {['Draft','NeedsCorrection'].includes(item.status) && <form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'InsufficientEvidence', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Insufficient-evidence reason<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} /></label><button disabled={busy}>Mark insufficient evidence</button></form>}
    {item.reviewNotes && <p className="price-preserve"><strong>Decision notes:</strong> {item.reviewNotes}</p>}
    {item.status === 'Draft' && <form className="price-form" onSubmit={e => { e.preventDefault(); void run(`${item.id}/decision`, { version: item.version, action: 'Reject', lowPerCent: 0, highPerCent: 0, validUntilUtc: new Date().toISOString(), notes }); }}><label>Reject this draft<textarea value={notes} onChange={e => setNotes(e.target.value)} required maxLength={4000} placeholder="Reason for rejection" /></label><button disabled={busy}>Reject draft</button></form>}
  </div>;
}
