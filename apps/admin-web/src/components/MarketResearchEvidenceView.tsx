import { useEffect, useState } from 'react';
import { api, PriceResearchItem, ResearchDetail } from '../services/api';
const money = (value?: number | null) => value == null ? '—' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function MarketResearchEvidenceView({ item }: { item: PriceResearchItem }) {
  const [detail, setDetail] = useState<ResearchDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; setDetail(null); setError('');
    api.priceResearch<ResearchDetail>(item.id).then(v => { if (active) setDetail(v); }).catch(e => { if (active) setError(e.message || 'Could not load details.'); });
    return () => { active = false; };
  }, [item.id, item.version]);
  const research = item.research; const review = item.evidenceReview;
  return <section className="market-evidence-details">
    <h4>Location & property</h4>
    <p>{item.locality} · {item.taluk || 'Taluk not supplied'} · {item.district}<br />
      {item.latitude}, {item.longitude} · {item.coverageRadiusMeters} m radius · {item.inputArea ?? 'Area not supplied'} {item.inputAreaUnit}</p>
    <a href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`} target="_blank" rel="noopener noreferrer">View selected map point</a>
    <h4>Gemini research from authorized evidence</h4>
    {!research ? <p>No evidence-assisted assessment. Legacy model suggestions are retained below for audit and cannot qualify as evidence-backed research.</p> : <>
      <p><strong>{research.status}</strong> · {research.groundingStatus} · {research.modelName}<br />
        Prompt {research.promptVersion} · {new Date(research.researchTimestampUtc).toLocaleString()} · {research.sourceCount} eligible source observations</p>
      {research.lowPerCent != null && <p className="price-proposal"><strong>Indicative asking range</strong>{money(research.lowPerCent)} – {money(research.highPerCent)} / cent<br />
        Typical asking rate {money(research.typicalPerCent)} / cent · {money(research.typicalPerSqFt)} / sq ft</p>}
      <p>Backend computes the range and median from accepted asking observations. This is neither a completed transaction nor independently verified market value.</p>
      <p><strong>Assumptions:</strong> {research.assumptions.join(' · ') || 'None supplied'}</p>
      <p><strong>Limitations:</strong> {research.limitations.join(' · ') || 'Research remains provisional.'}</p>

      <div className="market-evidence-list">{research.evidence.map(e => <article className="price-proposal" key={e.id}>
        <strong>{e.id} · {e.observation.sourceName || 'Source'}</strong><span>{e.status} · {e.retrievalStatus}</span>
        {e.resolvedUrl.startsWith('https://') ? <a href={e.resolvedUrl} target="_blank" rel="noopener noreferrer">{e.resolvedUrl}</a> : <span>No retrievable grounded URL</span>}
        <p>{e.observation.locationDescription} · Land category {e.observation.landCategory} · {e.distanceMeters == null ? 'Distance unknown' : `${Math.round(e.distanceMeters)} m from pin`}</p>
        <p>Original total asking amount {money(e.observation.askingPrice)} · {e.observation.area} {e.observation.areaUnit}<br />
          Normalised {money(e.ratePerCent)} / cent · {money(e.ratePerSqFt)} / sq ft</p>
        <p>Observation {e.observation.observationDate ? new Date(e.observation.observationDate).toLocaleDateString() : 'Unknown'} · Retrieved {new Date(e.retrievedAtUtc).toLocaleString()}</p>
        <p><strong>Source classification:</strong> {e.observation.sourceCategory}</p>
        <details><summary>Quoted source facts & deterministic checks</summary><p className="price-preserve">{[e.observation.askingContextQuote, e.observation.priceQuote, e.observation.areaQuote, e.observation.dateQuote, e.observation.locationQuote, e.observation.categoryQuote, e.observation.coordinateQuote].filter(Boolean).join('\n')}</p>
          <ul>{e.checks.map((c, i) => <li key={i}>{c}</li>)}</ul></details>
      </article>)}</div>
      <p>Research usage: {research.attemptedCalls} call(s), {research.totalTokens} tokens. Review usage: {review?.attemptedCalls ?? 0} call(s), {review?.totalTokens ?? 0} tokens. These counts are not a monetary bill.</p>
    </>}
    <h4>Separate AI evidence & consistency review</h4>
    {!review ? <p>Not reviewed. Two Gemini calls do not establish independent real-world verification.</p> : <>
      <p><strong>{review.status}</strong> · {review.evidenceQuality} · {review.reviewerModel}<br />{new Date(review.reviewedAtUtc).toLocaleString()}</p>
      <p>Accepted: {review.acceptedEvidenceIds.join(', ') || 'None'} · Rejected: {review.rejectedEvidenceIds.join(', ') || 'None'}</p>
      <p>Location mismatch: {review.locationMismatch ? 'Yes' : 'No'} · Category mismatch: {review.categoryMismatch ? 'Yes' : 'No'}</p>
      <p>Calculation errors: {review.calculationErrors.join(' · ') || 'None reported'}</p>
      <p>Contradictions: {review.contradictions.join(' · ') || 'None reported'}</p>
      <p>Corrections: {review.recommendedCorrections.join(' · ') || 'None requested'}</p>
      <p>AI review checks supporting evidence; it is not independent confirmation of land value.</p>
    </>}
    <h4>Broker opinion history · internal</h4>
    {error && <p role="alert">{error}</p>}
    {detail?.brokerObservations.map(b => <article className="price-proposal" key={b.id}>
      <strong>{b.brokerName} · {b.verificationStatus}</strong><span>{b.brokerLocality} · {new Date(b.assessmentDateUtc).toLocaleDateString()} · {b.sourceCategory}</span>
      <p>{money(b.lowPerCent)} – {money(b.highPerCent)} / cent · Typical {money(b.typicalPerCent)} / cent</p>
      <p>Familiarity: {b.familiarity} · Evidence type: {b.evidenceType}</p>
      <details><summary>Restricted contact & supporting notes</summary><p>{b.brokerId} · {b.contactReference || 'No contact reference'}<br />{b.evidenceNotes}<br />Existing document reference: {b.documentReference || 'Not supplied'}</p></details>
      {b.differencePercentage != null && <p><strong>AI/broker discrepancy: {b.differencePercentage}%</strong><br />ABS(AI typical − broker typical) ÷ broker typical × 100. This is a comparison metric, not an accuracy score. Neither opinion is automatically corrected to match the other.</p>}
    </article>)}
    {detail && detail.brokerObservations.length === 0 && <p>No independent broker assessment has been recorded.</p>}
    <details><summary>Auditable decision history</summary>{detail?.history.map(h => <p key={h.id}>{new Date(h.timestampUtc).toLocaleString()} · {h.action} · {h.performedBy}<br /><code>{h.details}</code></p>)}</details>
    <p>Verified transaction documents must be attached through the existing transaction evidence and moderation workflow. Approving research never creates a verified completed sale.</p>
  </section>;
}
