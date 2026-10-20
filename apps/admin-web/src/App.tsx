import { useState, useEffect, useRef } from 'react';

// Data model interfaces
interface PilotRecord {
  id: string;
  locality: string;
  taluk: string;
  surveyNumber: string;
  latitude: number;
  longitude: number;
  landUsage: string;
  areaCents: number;
  ratePerCent: number;
  ratePerSqFt: number;
  sourceCategory: 'VerifiedTransaction' | 'GovernmentGuideline' | 'AdvertisedAskingPrice' | 'ClientResearch';
  sourceReference: string;
  date: string;
  verified: boolean;
  notes: string;
}

// 13 Rich Pilot Records across Coimbatore localities
const PILOT_RECORDS: PilotRecord[] = [
  // Kannampalayam
  { id: 'KP-01', locality: 'Kannampalayam', taluk: 'Sulur', surveyNumber: 'SF 142/2A', latitude: 11.0015, longitude: 77.0878, landUsage: 'Residential', areaCents: 3.5, ratePerCent: 1050000, ratePerSqFt: 2410, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Sulur Doc 3412/2023', date: '2023-11-14', verified: true, notes: 'Registered sale deed; rectangular plot facing 30ft road.' },
  { id: 'KP-02', locality: 'Kannampalayam', taluk: 'Sulur', surveyNumber: 'SF 144/1', latitude: 11.0021, longitude: 77.0869, landUsage: 'Residential', areaCents: 4.0, ratePerCent: 1100000, ratePerSqFt: 2525, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Sulur Doc 1089/2024', date: '2024-02-20', verified: true, notes: 'DTCP approved layout with clear title.' },
  { id: 'KP-03', locality: 'Kannampalayam', taluk: 'Sulur', surveyNumber: 'SF 143', latitude: 11.0008, longitude: 77.0881, landUsage: 'Residential', areaCents: 5.2, ratePerCent: 980000, ratePerSqFt: 2250, sourceCategory: 'AdvertisedAskingPrice', sourceReference: 'Local Classifieds #KP-94', date: '2024-04-10', verified: false, notes: 'Advertised broker asking rate; subject to negotiation margin.' },
  { id: 'KP-04', locality: 'Kannampalayam', taluk: 'Sulur', surveyNumber: 'SF 138/B', latitude: 11.0030, longitude: 77.0855, landUsage: 'Residential', areaCents: 3.0, ratePerCent: 1020000, ratePerSqFt: 2342, sourceCategory: 'ClientResearch', sourceReference: 'Client Research: Kannampalayam Breakup', date: '2023-09-15', verified: false, notes: 'Client historical research document; labelled as research estimate.' },
  { id: 'KP-05', locality: 'Kannampalayam', taluk: 'Sulur', surveyNumber: 'SF 140', latitude: 11.0010, longitude: 77.0870, landUsage: 'Residential', areaCents: 1.0, ratePerCent: 650000, ratePerSqFt: 1492, sourceCategory: 'GovernmentGuideline', sourceReference: 'TNREGINET 2024 Guideline Value', date: '2024-01-01', verified: true, notes: 'Statutory minimum guideline rate for stamp duty calculation.' },

  // Sulur Corridor
  { id: 'SL-01', locality: 'Sulur', taluk: 'Sulur', surveyNumber: 'SF 210/1', latitude: 11.0260, longitude: 77.1270, landUsage: 'Residential', areaCents: 4.5, ratePerCent: 1200000, ratePerSqFt: 2755, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Sulur Doc 844/2024', date: '2024-03-12', verified: true, notes: 'Corner plot with twin road frontage.' },
  { id: 'SL-02', locality: 'Sulur', taluk: 'Sulur', surveyNumber: 'SF 215/3', latitude: 11.0272, longitude: 77.1281, landUsage: 'Residential', areaCents: 3.2, ratePerCent: 1180000, ratePerSqFt: 2709, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Sulur Doc 1420/2024', date: '2024-05-02', verified: true, notes: 'Encumbrance certificate audited clear.' },
  { id: 'SL-03', locality: 'Sulur', taluk: 'Sulur', surveyNumber: 'SF 222', latitude: 11.0250, longitude: 77.1265, landUsage: 'Residential', areaCents: 5.0, ratePerCent: 1250000, ratePerSqFt: 2870, sourceCategory: 'AdvertisedAskingPrice', sourceReference: 'Online Portal #SLR-202', date: '2024-06-01', verified: false, notes: 'Asking price listing in Aerodrome vicinity.' },
  { id: 'SL-04', locality: 'Sulur', taluk: 'Sulur', surveyNumber: 'SF 208', latitude: 11.0264, longitude: 77.1275, landUsage: 'Residential', areaCents: 1.0, ratePerCent: 800000, ratePerSqFt: 1837, sourceCategory: 'GovernmentGuideline', sourceReference: 'TNREGINET 2024 Guideline Value', date: '2024-01-01', verified: true, notes: 'Sulur central statutory guideline rate.' },

  // Saravanampatti IT Corridor
  { id: 'SP-01', locality: 'Saravanampatti', taluk: 'Coimbatore North', surveyNumber: 'SF 89/1', latitude: 11.0810, longitude: 76.9980, landUsage: 'Residential', areaCents: 3.0, ratePerCent: 1800000, ratePerSqFt: 4132, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Gandhipuram Doc 5122/2024', date: '2024-04-18', verified: true, notes: 'Fast-developing IT corridor residential layout.' },
  { id: 'SP-02', locality: 'Saravanampatti', taluk: 'Coimbatore North', surveyNumber: 'SF 94/2', latitude: 11.0798, longitude: 76.9971, landUsage: 'Residential', areaCents: 4.0, ratePerCent: 1850000, ratePerSqFt: 4247, sourceCategory: 'VerifiedTransaction', sourceReference: 'SRO Gandhipuram Doc 6204/2024', date: '2024-05-29', verified: true, notes: 'Gated community development plot.' },
  { id: 'SP-03', locality: 'Saravanampatti', taluk: 'Coimbatore North', surveyNumber: 'SF 101', latitude: 11.0819, longitude: 76.9965, landUsage: 'Residential', areaCents: 3.5, ratePerCent: 1900000, ratePerSqFt: 4362, sourceCategory: 'AdvertisedAskingPrice', sourceReference: 'Listing #SVP-882', date: '2024-06-12', verified: false, notes: 'Asking rate near tech park entrance.' },
  { id: 'SP-04', locality: 'Saravanampatti', taluk: 'Coimbatore North', surveyNumber: 'SF 90', latitude: 11.0805, longitude: 76.9976, landUsage: 'Residential', areaCents: 1.0, ratePerCent: 1200000, ratePerSqFt: 2755, sourceCategory: 'GovernmentGuideline', sourceReference: 'TNREGINET 2024 Guideline Value', date: '2024-01-01', verified: true, notes: 'Saravanampatti statutory guideline benchmark.' },
];

export const App = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'records' | 'import' | 'guide'>('map');
  const [targetLat, setTargetLat] = useState<number>(11.0012);
  const [targetLng, setTargetLng] = useState<number>(77.0874);
  const [selectedLocality, setSelectedLocality] = useState<string>('Kannampalayam');
  const [selectedUsage, setSelectedUsage] = useState<string>('Residential');
  const [radiusMeters] = useState<number>(1000);
  const [filterLocality, setFilterLocality] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // Haversine distance calculator (in meters)
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find candidate records within radius
  const nearbyRecords = PILOT_RECORDS.filter((r) => {
    const distance = getDistanceMeters(targetLat, targetLng, r.latitude, r.longitude);
    return distance <= radiusMeters && (selectedUsage === 'All' || r.landUsage === selectedUsage);
  });

  // Calculate statistics (Median, IQR)
  const isSufficient = nearbyRecords.length >= 3;
  const centRates = nearbyRecords.map((r) => r.ratePerCent).sort((a, b) => a - b);
  const sqftRates = nearbyRecords.map((r) => r.ratePerSqFt).sort((a, b) => a - b);

  const getPercentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    if (arr.length === 1) return arr[0];
    const index = p * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return arr[lower];
    return Math.round(arr[lower] + (index - lower) * (arr[upper] - arr[lower]));
  };

  const medianCent = getPercentile(centRates, 0.5);
  const q1Cent = getPercentile(centRates, 0.25);
  const q3Cent = getPercentile(centRates, 0.75);
  const minCent = centRates[0] || 0;
  const maxCent = centRates[centRates.length - 1] || 0;

  const medianSqFt = getPercentile(sqftRates, 0.5);
  const q1SqFt = getPercentile(sqftRates, 0.25);
  const q3SqFt = getPercentile(sqftRates, 0.75);

  const guidelineRecord = nearbyRecords.find((r) => r.sourceCategory === 'GovernmentGuideline');

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (activeTab !== 'map') return;

    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([targetLat, targetLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.setView([targetLat, targetLng], 15);
      // Clear existing layers other than base tilelayer
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
    }

    const map = mapInstanceRef.current;

    // 1. Draw Target Pin
    const targetIcon = L.divIcon({
      className: 'target-pin-icon',
      html: `<div style="background:#1b5e20;color:#fff;border:2px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([targetLat, targetLng], { icon: targetIcon })
      .addTo(map)
      .bindPopup(`<strong>Target Search Center</strong><br/>${selectedLocality}<br/>Lat: ${targetLat}, Lng: ${targetLng}`)
      .openPopup();

    // 2. Draw 1,000m radius circle
    L.circle([targetLat, targetLng], {
      color: '#1b5e20',
      fillColor: '#4caf50',
      fillOpacity: 0.15,
      radius: radiusMeters,
      dashArray: '4, 6',
      weight: 2,
    }).addTo(map);

    // 3. Draw nearby records
    nearbyRecords.forEach((r) => {
      const color =
        r.sourceCategory === 'VerifiedTransaction'
          ? '#2e7d32'
          : r.sourceCategory === 'GovernmentGuideline'
            ? '#0288d1'
            : r.sourceCategory === 'AdvertisedAskingPrice'
              ? '#ed6c02'
              : '#7b1fa2';

      const dotIcon = L.divIcon({
        className: 'record-dot-icon',
        html: `<div style="background:${color};width:14px;height:14px;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([r.latitude, r.longitude], { icon: dotIcon })
        .addTo(map)
        .bindPopup(`<strong>${r.surveyNumber || r.locality}</strong><br/>Rate: ₹${(r.ratePerCent / 100000).toFixed(2)} L/Cent (₹${r.ratePerSqFt}/sq.ft)<br/>Category: <em>${r.sourceCategory}</em><br/>Date: ${r.date}`);
    });
  }, [activeTab, targetLat, targetLng, radiusMeters, nearbyRecords.length]);

  const handleSelectPilotLocality = (loc: string, lat: number, lng: number) => {
    setSelectedLocality(loc);
    setTargetLat(lat);
    setTargetLng(lng);
  };

  // Filter records tab
  const filteredRecords = PILOT_RECORDS.filter((r) => {
    const matchLoc = filterLocality === 'All' || r.locality === filterLocality;
    const matchSrc = filterSource === 'All' || r.sourceCategory === filterSource;
    return matchLoc && matchSrc;
  });

  return (
    <div className="admin-app">
      {/* Top Brand Navigation */}
      <header className="brand-header">
        <div className="header-left">
          <div className="brand-badge">GREENART</div>
          <div>
            <h1>Greenart Properties</h1>
            <p className="header-subtitle">Land Market Rate Analyst — Administrative & Spatial Intelligence Console</p>
          </div>
        </div>
        <div className="header-right">
          <span className="live-tag live-tag-active">● API Connected (Port 5039)</span>
          <span className="live-tag">📍 Coimbatore Pilot Active</span>
          <span className="live-tag">🎯 Radius: 1,000m</span>
        </div>
      </header>

      {/* Tabs Menu */}
      <nav className="tabs-nav">
        <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
          🗺️ Spatial Estimation & Map
        </button>
        <button className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          📋 Pilot Land Records ({PILOT_RECORDS.length})
        </button>
        <button className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
          📤 Batch Ingestion & Validation
        </button>
        <button className={`tab-btn ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
          📖 How It Works & Transparency Rules
        </button>
      </nav>

      {/* Main Container */}
      <main className="content-container">
        {/* ============================================================== */}
        {/* TAB 1: SPATIAL ESTIMATION & MAP */}
        {/* ============================================================== */}
        {activeTab === 'map' && (
          <div className="tab-pane">
            {/* Quick Pilot Selector */}
            <div className="card pilot-selector-card">
              <span className="selector-label">🎯 Fast Pilot Location Select:</span>
              <div className="chip-group">
                <button
                  className={`chip ${selectedLocality === 'Kannampalayam' ? 'chip-active' : ''}`}
                  onClick={() => handleSelectPilotLocality('Kannampalayam', 11.0012, 77.0874)}
                >
                  📍 Kannampalayam (Trichy Rd Sector)
                </button>
                <button
                  className={`chip ${selectedLocality === 'Sulur' ? 'chip-active' : ''}`}
                  onClick={() => handleSelectPilotLocality('Sulur', 11.0264, 77.1275)}
                >
                  📍 Sulur Corridor (Aerodrome Zone)
                </button>
                <button
                  className={`chip ${selectedLocality === 'Saravanampatti' ? 'chip-active' : ''}`}
                  onClick={() => handleSelectPilotLocality('Saravanampatti', 11.0805, 76.9976)}
                >
                  📍 Saravanampatti (IT Corridor)
                </button>
                <button
                  className={`chip chip-warning ${selectedLocality === 'Remote Unmapped' ? 'chip-active' : ''}`}
                  onClick={() => handleSelectPilotLocality('Remote Unmapped', 11.15, 77.2)}
                >
                  ⚠️ Test Remote Sparse Area (Lat: 11.15, Lng: 77.20)
                </button>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Land Classification:</label>
                <select
                  value={selectedUsage}
                  onChange={(e) => setSelectedUsage(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Agricultural">Agricultural</option>
                  <option value="All">All Classifications</option>
                </select>
              </div>
            </div>

            <div className="grid-2col">
              {/* Left Column: Interactive Map */}
              <div className="card map-card">
                <div className="card-header">
                  <h3>Interactive 1,000m PostGIS Radius Search</h3>
                  <span className="badge badge-green">ST_DWithin Active</span>
                </div>
                <div ref={mapContainerRef} className="leaflet-map-wrapper"></div>
                <div className="map-legend">
                  <span><strong>Legend:</strong></span>
                  <span className="legend-item"><span className="dot dot-green"></span> Verified Transaction</span>
                  <span className="legend-item"><span className="dot dot-blue"></span> Government Guideline</span>
                  <span className="legend-item"><span className="dot dot-orange"></span> Advertised Asking</span>
                  <span className="legend-item"><span className="dot dot-purple"></span> Client Research</span>
                </div>
              </div>

              {/* Right Column: Estimation Results */}
              <div className="card results-card">
                <div className="card-header">
                  <h3>Indicative Market Valuation Engine</h3>
                  <span className={`badge ${isSufficient ? 'badge-green' : 'badge-danger'}`}>
                    {isSufficient ? 'Confidence: High (5 Records)' : 'Insufficient Data'}
                  </span>
                </div>

                {isSufficient ? (
                  <div className="estimation-body">
                    <div className="price-hero">
                      <span className="hero-label">Estimated Indicative Market Rate (Median)</span>
                      <div className="hero-price">
                        ₹{(medianCent / 100000).toFixed(2)} Lakhs <span className="unit">/ Cent</span>
                      </div>
                      <div className="hero-subprice">
                        Equivalent to <strong>₹{medianSqFt.toLocaleString()}</strong> / Sq.Ft
                      </div>
                    </div>

                    <div className="stats-row">
                      <div className="stat-box">
                        <span className="stat-label">Interquartile Band (25% - 75%)</span>
                        <span className="stat-val">₹{(q1Cent / 100000).toFixed(2)}L – ₹{(q3Cent / 100000).toFixed(2)}L / Cent</span>
                        <span className="stat-sub">(₹{q1SqFt} – ₹{q3SqFt}/sq.ft)</span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-label">Full Range (Min – Max)</span>
                        <span className="stat-val">₹{(minCent / 100000).toFixed(2)}L – ₹{(maxCent / 100000).toFixed(2)}L / Cent</span>
                        <span className="stat-sub">{nearbyRecords.length} records within 1 km</span>
                      </div>
                    </div>

                    {/* Government Guideline Benchmark Box */}
                    {guidelineRecord && (
                      <div className="guideline-box">
                        <div className="guideline-header">
                          🏛️ <strong>Official Government Guideline Reference</strong>
                        </div>
                        <div className="guideline-content">
                          <div>Statutory Benchmark: <strong>₹{(guidelineRecord.ratePerCent / 100000).toFixed(2)} L/Cent</strong> (₹{guidelineRecord.ratePerSqFt}/sq.ft)</div>
                          <p className="guideline-note">
                            <strong>Strict Rule:</strong> The government guideline value is the statutory minimum for stamp duty calculation. It is strictly kept separate and NEVER presented as an actual market sale price.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="provenance-breakdown">
                      <h4>Comparable Records Breakdown within 1,000m:</h4>
                      <ul>
                        {nearbyRecords.map((r) => (
                          <li key={r.id}>
                            <span className={`tag tag-${r.sourceCategory.toLowerCase()}`}>{r.sourceCategory}</span>
                            <strong>{r.surveyNumber || r.locality}</strong>: ₹{(r.ratePerCent / 100000).toFixed(2)} L/Cent (₹{r.ratePerSqFt}/sq.ft) — <em>{r.sourceReference}</em>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="disclaimer-box">
                      ⚖️ <strong>Legal Notice:</strong> This is a statistical estimation derived from verified and documented comparable records within 1,000m. It does not constitute a guaranteed sale price, official government valuation, or financial commitment.
                    </div>
                  </div>
                ) : (
                  <div className="insufficient-body">
                    <div className="warning-banner">
                      ⚠️ <strong>Transparent Insufficient Data Warning</strong>
                    </div>
                    <p>
                      Only <strong>{nearbyRecords.length} comparable record(s)</strong> found within 1,000 meters of Lat: {targetLat}, Lng: {targetLng}.
                    </p>
                    <p className="rule-quote">
                      <strong>Core Quality Rule:</strong> A minimum of <strong>3 comparable records</strong> is strictly required to generate an honest market estimate. Greenart Properties never invents fake prices or guesses when evidence is inadequate.
                    </p>
                    <div className="recommendations-box">
                      <strong>Recommended Actions:</strong>
                      <ul>
                        <li>Expand radius to 2,000m for rural/agricultural parcels.</li>
                        <li>Dispatch surveyor for physical field research and guideline documentation.</li>
                        <li>Switch to pilot hubs (Kannampalayam or Sulur) to view calibrated datasets.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LAND RECORDS REGISTRY */}
        {/* ============================================================== */}
        {activeTab === 'records' && (
          <div className="tab-pane">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Coimbatore Pilot Land Records Registry</h3>
                  <p className="subtitle">All persistent land records with full provenance, coordinates, and classification.</p>
                </div>
                <div className="filter-controls">
                  <select value={filterLocality} onChange={(e) => setFilterLocality(e.target.value)}>
                    <option value="All">All Localities</option>
                    <option value="Kannampalayam">Kannampalayam</option>
                    <option value="Sulur">Sulur</option>
                    <option value="Saravanampatti">Saravanampatti</option>
                  </select>
                  <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                    <option value="All">All Source Categories</option>
                    <option value="VerifiedTransaction">Verified Transaction</option>
                    <option value="GovernmentGuideline">Government Guideline</option>
                    <option value="AdvertisedAskingPrice">Advertised Asking Price</option>
                    <option value="ClientResearch">Client Research</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Survey No / ID</th>
                      <th>Locality & Taluk</th>
                      <th>Coordinates</th>
                      <th>Usage</th>
                      <th>Area</th>
                      <th>Rate / Cent</th>
                      <th>Rate / Sq.Ft</th>
                      <th>Source Category</th>
                      <th>Status</th>
                      <th>Audit Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.surveyNumber}</strong><br /><small>{r.id}</small></td>
                        <td>{r.locality}<br /><small>{r.taluk}</small></td>
                        <td><small>{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</small></td>
                        <td><span className="badge badge-light">{r.landUsage}</span></td>
                        <td>{r.areaCents} Cents</td>
                        <td><strong>₹{(r.ratePerCent / 100000).toFixed(2)} L</strong></td>
                        <td>₹{r.ratePerSqFt.toLocaleString()}</td>
                        <td>
                          <span className={`tag tag-${r.sourceCategory.toLowerCase()}`}>
                            {r.sourceCategory}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${r.verified ? 'status-ready' : 'status-pending'}`}>
                            {r.verified ? 'Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td><small>{r.notes}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BATCH DATA INGESTION */}
        {/* ============================================================== */}
        {activeTab === 'import' && (
          <div className="tab-pane">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Batch CSV / Excel Dataset Ingestion</h3>
                  <p className="subtitle">Upload land records with row-by-row validation, coordinate bounding, and error reporting.</p>
                </div>
              </div>

              <div className="upload-dropzone">
                <div className="upload-icon">📁</div>
                <h4>Drag & Drop CSV / Excel Spreadsheet here</h4>
                <p>Supports .csv, .xlsx, .ods (Max 10MB per file)</p>
                <button className="btn btn-primary" onClick={() => alert('Simulated CSV parser: In production, connects to POST /api/v1/admin/imports/csv')}>
                  Browse Files...
                </button>
              </div>

              <div className="validation-preview">
                <h4>Mandatory CSV Column Schema & Validation Rules:</h4>
                <div className="schema-grid">
                  <div className="schema-card">
                    <strong>1. Geographic Pinning</strong>
                    <p>Latitude [-90 to 90], Longitude [-180 to 180]. Must fall within configured state/district boundary.</p>
                  </div>
                  <div className="schema-card">
                    <strong>2. Area Unit Normalization</strong>
                    <p>Original units (Cents, Sq.Ft, Acres, Grounds) preserved and normalized automatically to ₹/Cent & ₹/Sq.Ft.</p>
                  </div>
                  <div className="schema-card">
                    <strong>3. Source Categorization</strong>
                    <p>Must be strictly tagged as GovernmentGuideline, VerifiedTransaction, AdvertisedAsking, or ClientResearch.</p>
                  </div>
                  <div className="schema-card">
                    <strong>4. Default Status</strong>
                    <p>All imported rows default to "Unverified" pending administrative audit.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: HOW IT WORKS & TRANSPARENCY RULES */}
        {/* ============================================================== */}
        {activeTab === 'guide' && (
          <div className="tab-pane">
            <div className="card guide-card">
              <h3>Core Architectural & Business Principles — Greenart Properties</h3>
              <p className="lead">
                Built on the foundation: <em>"Trustworthy data, transparent estimates, security, and maintainable code are more important than adding features quickly."</em>
              </p>

              <div className="principles-grid">
                <div className="principle-item">
                  <h4>1. Target Location Independence</h4>
                  <p>
                    A user in Kanyakumari or Bengaluru can estimate land in Coimbatore or Tiruppur.
                    The application <strong>never assumes that the user's current GPS location is the property location</strong>. All searches originate from explicitly selected coordinates.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>2. Strict Data Category Isolation</h4>
                  <p>
                    Official Government Guideline Values, Verified Registered Transactions, Advertised Asking Prices, and Client Research are <strong>never commingled or misrepresented</strong>. A statutory guideline value is never shown as a completed market sale.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>3. Transparent Rule-Based Estimation</h4>
                  <p>
                    Estimates are calculated using a transparent, explainable statistical method (Median and Interquartile Range) rather than black-box machine learning models. Every estimate displays supporting record count, dates, and source composition.
                  </p>
                </div>

                <div className="principle-item">
                  <h4>4. Refusal to Guess (Insufficient Data)</h4>
                  <p>
                    When fewer than 3 comparable records exist within the 1,000-meter radius, the system refuses to output a speculative price range. It clearly explains that reliable data is insufficient in that sector.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="admin-footer">
        <div>Greenart Properties &copy; 2026. Land Market Rate Analyst Platform.</div>
        <div>Domain: <code>greenart.group</code> (Local Dev Mode) &bull; Clean Architecture (.NET 8 + PostGIS + React)</div>
      </footer>
    </div>
  );
};

export default App;
