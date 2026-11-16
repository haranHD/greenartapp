import React, { useEffect, useState } from 'react';
import { api, ProviderSummary } from '../services/api';

export interface ProviderHealthViewProps { onRefresh?: () => void; }

export const ProviderHealthView: React.FC<ProviderHealthViewProps> = ({ onRefresh }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [landLens, setLandLens] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([api.getProviders(), api.getLandLensConfiguration()]);
    if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setProviders(results[0].value);
    else { setProviders([]); setError('The provider registry could not be loaded. Please retry.'); }
    if (results[1].status === 'fulfilled' && typeof results[1].value.configured === 'boolean') setLandLens(results[1].value.configured);
    else setLandLens(null);
    setCheckedAt(new Date().toLocaleTimeString()); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="provider-workspace operations-view">
    <section className="workspace-intro">
      <div className="workspace-eyebrow">DATA CONNECTIONS</div>
      <h1>Know where your data comes from.</h1>
      <p className="workspace-description">Review registered sources, their permitted uses, and the LandLens configuration available to this backend.</p>
      <div className="dashboard-actions"><button className="btn btn-primary" disabled={loading} onClick={() => { void load(); onRefresh?.(); }}>{loading ? 'Checking…' : 'Refresh connections'}</button>{checkedAt && <span className="provider-check-time">Last checked {checkedAt}</span>}</div>
    </section>
    {error && <div className="flash-banner" role="alert">{error}</div>}
    <section className="panel-card provider-connection-card">
      <div><span className="workspace-eyebrow">PARCEL & PRICE INTELLIGENCE</span><h2>LandLens</h2><p>Parcel details, guideline benchmarks and registered-sale reports.</p></div>
      <span className={`badge ${landLens === true ? 'badge-purple' : 'badge-gold'}`}>{loading ? 'Checking' : landLens === true ? 'Configured' : landLens === false ? 'Not configured' : 'Status unavailable'}</span>
      <p className="provider-note">Configuration confirms a server-side key is present. Live access, credit balance and service availability have not been tested here.</p>
    </section>
    <div className="provider-section-heading"><h2>Registered data sources</h2><p>Coverage and usage information reported by your backend.</p></div>
    <div className="provider-grid">
      {providers.map(provider => <article className="panel-card provider-source-card" key={provider.providerId}>
        <div className="provider-source-heading"><h3>{provider.providerName}</h3><span className="badge badge-purple">{provider.sourceCategory}</span></div>
        <p>{provider.permittedUsage}</p>
        <dl><div><dt>Coverage</dt><dd>{provider.coverage?.statewide ? 'Statewide' : provider.coverage?.coveredDistricts?.join(', ') || provider.coverage?.regionName || 'Not specified'}</dd></div><div><dt>Feed capability</dt><dd>{provider.isLiveFeedAvailable ? 'Live feed supported' : 'Recorded data / manual updates'}</dd></div></dl>
        {provider.dataIntegrityNote && <p className="provider-note">{provider.dataIntegrityNote}</p>}
        {provider.licenseTerms && <details><summary>Usage terms</summary><p>{provider.licenseTerms}</p></details>}
      </article>)}
    </div>
    {!loading && !error && providers.length === 0 && <div className="panel-card provider-source-card"><p>No sources are registered in the backend yet.</p></div>}
  </div>;
};
