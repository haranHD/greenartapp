import { useState, useEffect } from 'react';
import { api, SurveyVerificationRequestDto, ConfirmSurveyRequest } from '../services/api';

interface LocationSurveysViewProps {
  adminKey?: string;
  onRecordCreated?: () => void;
}

export const LocationSurveysView: React.FC<LocationSurveysViewProps> = ({ adminKey: _adminKey, onRecordCreated }) => {
  const [surveys, setSurveys] = useState<SurveyVerificationRequestDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Active modal or inline form state
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('');
  const [brokerPhone, setBrokerPhone] = useState<string>('');
  const [confirmedRate, setConfirmedRate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchSurveys = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminSurveys();
      setSurveys(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch location surveys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  const openConfirmForm = (survey: SurveyVerificationRequestDto) => {
    setSelectedSurveyId(survey.id);
    setBrokerName('');
    setBrokerPhone('');
    setConfirmedRate(survey.estimatedRatePerCent ? survey.estimatedRatePerCent.toString() : '');
    setNotes(`Ground verification for pinned location in ${survey.locality}`);
    setSuccessMessage(null);
  };

  const closeConfirmForm = () => {
    setSelectedSurveyId(null);
    setBrokerName('');
    setBrokerPhone('');
    setConfirmedRate('');
    setNotes('');
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurveyId) return;

    if (!brokerName.trim()) {
      alert('Broker Name is required.');
      return;
    }

    if (!brokerPhone.trim()) {
      alert('Broker Phone Number is required.');
      return;
    }

    const rateNum = parseFloat(confirmedRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      alert('Confirmed Rate per Cent must be a positive number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const request: ConfirmSurveyRequest = {
        brokerName: brokerName.trim(),
        brokerPhone: brokerPhone.trim(),
        confirmedRatePerCent: rateNum,
        notes: notes.trim() || undefined,
      };

      const res = await api.confirmAdminSurvey(selectedSurveyId, request);
      setSuccessMessage(res.message || 'Survey confirmed and saved to official land records!');
      closeConfirmForm();
      await fetchSurveys();
      if (onRecordCreated) {
        onRecordCreated();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm survey.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = surveys.filter((s) => {
    if (filterStatus === 'All') return true;
    return s.status === filterStatus;
  });

  const pendingCount = surveys.filter((s) => s.status === 'PendingBrokerCall').length;
  const confirmedCount = surveys.filter((s) => s.status === 'Confirmed').length;

  return (
    <div className="operations-view" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: 24, borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <span>📍</span> PINNED LOCATION GROUND VERIFICATION
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              Location Surveys & Broker Verification
            </h2>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0, maxWidth: 850, lineHeight: 1.5 }}>
              Locations pinned by users where no recent registered deed evidence exists. Call the local area broker to verify actual on-ground market rates. Once confirmed, records are saved directly to the database to build Greenart's proprietary historical land dataset.
            </p>
          </div>
          <button
            onClick={fetchSurveys}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh Surveys'}
          </button>
        </div>

        {/* Counter Summary Pills */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setFilterStatus('All')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: filterStatus === 'All' ? '2px solid #0F172A' : '1px solid #E2E8F0',
              background: filterStatus === 'All' ? '#F8FAFC' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Surveys ({surveys.length})
          </button>
          <button
            onClick={() => setFilterStatus('PendingBrokerCall')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: filterStatus === 'PendingBrokerCall' ? '2px solid #D97706' : '1px solid #E2E8F0',
              background: filterStatus === 'PendingBrokerCall' ? '#FEF3C7' : '#FFFFFF',
              color: '#B45309',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📞 Pending Broker Call ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('Confirmed')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: filterStatus === 'Confirmed' ? '2px solid #059669' : '1px solid #E2E8F0',
              background: filterStatus === 'Confirmed' ? '#ECFDF5' : '#FFFFFF',
              color: '#047857',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✅ Confirmed & In DB ({confirmedCount})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
          🎉 {successMessage}
        </div>
      )}

      {/* Modal / Confirmation Form */}
      {selectedSurveyId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 12,
            maxWidth: 550,
            width: '100%',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                📞 Confirm Broker Rate & Save to DB
              </h3>
              <button onClick={closeConfirmForm} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>
                ×
              </button>
            </div>

            {(() => {
              const survey = surveys.find(s => s.id === selectedSurveyId);
              if (!survey) return null;
              return (
                <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 13, border: '1px solid #E2E8F0' }}>
                  <div><strong>Locality:</strong> {survey.locality}, {survey.district}</div>
                  <div><strong>Coordinates:</strong> {survey.latitude.toFixed(5)}, {survey.longitude.toFixed(5)}</div>
                  <div><strong>Zoning:</strong> {survey.landUsage}</div>
                  <div><strong>AI Cross-Verified Rate:</strong> ₹{survey.estimatedRatePerCent?.toLocaleString('en-IN')}/Cent</div>
                  {survey.guidelineRatePerCent && (
                    <div><strong>Govt Guideline Rate:</strong> ₹{survey.guidelineRatePerCent?.toLocaleString('en-IN')}/Cent</div>
                  )}
                </div>
              );
            })()}

            <form onSubmit={handleConfirmSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Local Broker / Agent Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senthil Kumar (RS Puram Land Promoters)"
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Broker Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9842100000"
                  value={brokerPhone}
                  onChange={(e) => setBrokerPhone(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Confirmed Ground Rate (₹ per Cent) *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 1450000"
                  value={confirmedRate}
                  onChange={(e) => setConfirmedRate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Verification Notes / Evidence Details
                </label>
                <textarea
                  placeholder="e.g. Spoke with broker; active plots on 30ft road selling at this rate. Documented via phone survey."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={closeConfirmForm}
                  style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#059669',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Saving to Database...' : '💾 Save Verified Rate to DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Surveys List / Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          Loading location surveys...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          No location surveys found for the selected filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {filtered.map((survey) => {
            const isConfirmed = survey.status === 'Confirmed';
            return (
              <div
                key={survey.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: isConfirmed ? '1px solid #A7F3D0' : '1px solid #FCD34D',
                  padding: 20,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  {/* Status & Locality */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700, color: '#0F172A' }}>
                        {survey.locality}
                      </h4>
                      <div style={{ fontSize: 13, color: '#64748B' }}>
                        {survey.district} • ({survey.latitude.toFixed(4)}, {survey.longitude.toFixed(4)})
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: isConfirmed ? '#ECFDF5' : '#FEF3C7',
                        color: isConfirmed ? '#065F46' : '#B45309',
                        border: isConfirmed ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                      }}
                    >
                      {isConfirmed ? '✅ Confirmed in DB' : '⏳ Pending Broker Call'}
                    </span>
                  </div>

                  {/* Benchmark Comparison Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                        Cross-Verified Rate
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                        ₹{survey.estimatedRatePerCent?.toLocaleString('en-IN')}/Cent
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        ₹{survey.estimatedRatePerSqFt?.toLocaleString('en-IN')}/Sq.Ft
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                        Guideline Benchmark
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                        {survey.guidelineRatePerCent ? `₹${survey.guidelineRatePerCent?.toLocaleString('en-IN')}/Cent` : 'N/A'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Zoning: {survey.landUsage}
                      </div>
                    </div>
                  </div>

                  {/* Confirmed Details if Confirmed */}
                  {isConfirmed && (
                    <div style={{ marginTop: 12, padding: 10, background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0', fontSize: 13, color: '#166534' }}>
                      <div><strong>Ground Broker:</strong> {survey.brokerName} ({survey.brokerPhone})</div>
                      <div><strong>Confirmed Rate:</strong> ₹{survey.confirmedRatePerCent?.toLocaleString('en-IN')}/Cent</div>
                      {survey.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{survey.notes}"</div>}
                      <div style={{ fontSize: 11, color: '#15803D', marginTop: 6 }}>
                        Confirmed on {new Date(survey.confirmedAtUtc!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
                    User Pinned on: {new Date(survey.createdAtUtc).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Actions */}
                {!isConfirmed ? (
                  <button
                    onClick={() => openConfirmForm(survey)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    📞 Call Broker & Confirm Ground Rate
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#059669' }}>
                    ✓ Preserved as Local Rate Survey in DB
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
