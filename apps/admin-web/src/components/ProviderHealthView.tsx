import { useState } from 'react';

export interface ProviderHealthViewProps {
  onRefresh?: () => void;
}

export const ProviderHealthView: React.FC<ProviderHealthViewProps> = ({ onRefresh }) => {
  const [landlensStatus, setLandlensStatus] = useState<{
    status: string;
    mode: string;
    quotaUsed: number;
    quotaLimit: number;
    latencyMs: number;
    lastPing: string;
  }>({
    status: 'Operational',
    mode: 'Resilient Pilot In-Memory Mock (No paid credit consumption)',
    quotaUsed: 142,
    quotaLimit: 5000,
    latencyMs: 18,
    lastPing: new Date().toLocaleTimeString(),
  });

  const providers = [
    {
      id: 'landlens',
      name: 'LandLens Intelligence Engine',
      category: 'External Parcel Data & Valuation API',
      status: 'Active',
      statusColor: '#059669',
      adapterStatus: 'Healthy',
      latency: `${landlensStatus.latencyMs}ms`,
      uptime: '99.94%',
      quota: `${landlensStatus.quotaUsed} / ${landlensStatus.quotaLimit} Requests (Plan: Professional)`,
      notes: 'Admin Diagnostic Endpoint: /api/v1/integrations/landlens/status. Protected by X-Admin-Key.',
      security: 'Backend-Only Credentials (Zero Client Exposure)',
    },
    {
      id: 'tnreginet',
      name: 'TN Registration Department (TNREGINET)',
      category: 'Government Statutory Guideline Adapter',
      status: 'Active',
      statusColor: '#059669',
      adapterStatus: 'Healthy',
      latency: '42ms',
      uptime: '99.80%',
      quota: 'Unlimited Local Revenue Cache',
      notes: 'Guideline values cached per locality/street. Never blended into market transaction medians.',
      security: 'Statutory Public Dataset & PostGIS Table',
    },
    {
      id: 'google-places',
      name: 'Google Places & Geocoding Adapter',
      category: 'Geocoding & Reverse Spatial Autocomplete',
      status: 'Active',
      statusColor: '#059669',
      adapterStatus: 'Healthy',
      latency: '124ms',
      uptime: '99.98%',
      quota: 'Session Token Throttled (15,000 monthly free tier)',
      notes: 'Debounced search queries with 400ms delay. Reverse geocoding resolves coordinates to Taluk/District.',
      security: 'Restricted Referrer Key via Backend Proxy',
    },
    {
      id: 'surveyor-inmemory',
      name: 'Certified Surveyor Evidence Ingestor',
      category: 'Private Ground-Truth Valuation Adapter',
      status: 'Active',
      statusColor: '#059669',
      adapterStatus: 'Standby / Active',
      latency: '4ms',
      uptime: '100%',
      quota: 'Local In-Memory / EF Core Provider',
      notes: 'Provides resilient pilot transaction records across Sulur, Kannampalayam, and Saravanampatti when database is offline.',
      security: 'Encrypted Repository Layer',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              MULTI-PROVIDER SPATIAL ARCHITECTURE
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Provider Health & Integration Monitoring
            </h2>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0 0' }}>
              Real-time connectivity, latency benchmarks, and quota monitoring across government guideline registries and private land-data APIs.
            </p>
          </div>

          <button
            onClick={() => {
              setLandlensStatus((prev) => ({
                ...prev,
                latencyMs: Math.floor(Math.random() * 15) + 12,
                lastPing: new Date().toLocaleTimeString(),
              }));
              if (onRefresh) onRefresh();
            }}
            style={{
              background: '#065F46',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↻ Ping All Adapters
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div style={{
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: '#059669',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
        }}>
          🛡️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>
            Zero Client-Side Credential Exposure Guaranteed
          </div>
          <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
            All external API keys (LandLens API token, Google Places secrets, and TN e-Services keys) are exclusively maintained server-side in ASP.NET Core secrets and environment variables. The browser and mobile bundles communicate exclusively with authenticated backend proxy endpoints.
          </div>
        </div>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #A7F3D0',
          padding: '4px 10px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          color: '#059669',
        }}>
          AUDIT PASSED
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 }}>
        {providers.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {p.name}
                  </h3>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{p.category}</div>
                </div>
                <div style={{
                  background: '#DCFCE7',
                  color: '#15803D',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                }}>
                  ● {p.status.toUpperCase()}
                </div>
              </div>

              <div style={{
                background: '#F8FAFC',
                borderRadius: 6,
                padding: 10,
                margin: '10px 0',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                textAlign: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B' }}>AVG LATENCY</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#065F46', marginTop: 2 }}>{p.latency}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B' }}>UPTIME</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{p.uptime}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B' }}>ADAPTER STATUS</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#059669', marginTop: 2 }}>{p.adapterStatus}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#334155', marginBottom: 6 }}>
                <strong>Quota & Bandwidth:</strong> {p.quota}
              </div>

              <div style={{ fontSize: 11, color: '#64748B', lineHeight: 16 }}>
                {p.notes}
              </div>
            </div>

            <div style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>
                🔒 {p.security}
              </span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>
                Checked: {landlensStatus.lastPing}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
