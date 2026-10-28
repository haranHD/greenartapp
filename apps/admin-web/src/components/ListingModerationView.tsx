import { useState } from 'react';
import { MarketplaceListing, ListingStatus } from '@greenart/shared-types';

export interface ListingModerationViewProps {
  listings: MarketplaceListing[];
  onApproveListing: (id: string) => void;
  onRejectListing: (id: string, reason: string) => void;
}

export const ListingModerationView: React.FC<ListingModerationViewProps> = ({
  listings,
  onApproveListing,
  onRejectListing,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const filtered = listings.filter((item) => {
    if (filterStatus !== 'All' && item.status !== filterStatus) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchLoc = item.locality.toLowerCase().includes(q);
      const matchSeller = item.sellerName.toLowerCase().includes(q);
      const matchSurvey = item.surveyNumber ? item.surveyNumber.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchLoc && !matchSeller && !matchSurvey) return false;
    }
    return true;
  });

  const handleConfirmReject = () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      alert('Please enter a specific reason for rejection so the seller can address the discrepancy.');
      return;
    }
    onRejectListing(rejectingId, rejectReason.trim());
    setRejectingId(null);
    setRejectReason('');
  };

  const formatLakhs = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              MARKETPLACE GOVERNANCE
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Plot Listing Moderation Queue
            </h2>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0 0' }}>
              Review seller-submitted land listings, verify revenue survey numbers against TN Land Records, and enforce price sanity heuristics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center', background: '#F8FAFC', padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                {listings.filter((l) => l.status === ListingStatus.PendingReview).length}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Pending Review</div>
            </div>
            <div style={{ textAlign: 'center', background: '#F8FAFC', padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                {listings.filter((l) => l.status === ListingStatus.Active).length}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Active in Market</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <input
          type="text"
          placeholder="Filter by plot title, locality, seller, or survey number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            fontSize: 13,
            color: '#0F172A',
          }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {['All', ListingStatus.PendingReview, ListingStatus.Active, ListingStatus.Rejected].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: filterStatus === st ? '1px solid #065F46' : '1px solid #CBD5E1',
                background: filterStatus === st ? '#065F46' : '#FFFFFF',
                color: filterStatus === st ? '#FFFFFF' : '#334155',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Moderation Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '12px 14px' }}>Listing & Locality</th>
              <th style={{ padding: '12px 14px' }}>Extent & Usage</th>
              <th style={{ padding: '12px 14px' }}>Seller Details</th>
              <th style={{ padding: '12px 14px' }}>Asking Rate</th>
              <th style={{ padding: '12px 14px' }}>Guideline Benchmark</th>
              <th style={{ padding: '12px 14px' }}>Price Sanity Ratio</th>
              <th style={{ padding: '12px 14px' }}>Status</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Review Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                  No listings found matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const ratio = item.guidelineRatePerCent && item.guidelineRatePerCent > 0
                  ? item.askingRatePerCent / item.guidelineRatePerCent
                  : 1.0;

                const isPending = item.status === ListingStatus.PendingReview;
                const isActive = item.status === ListingStatus.Active;
                const isRejected = item.status === ListingStatus.Rejected;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.title}</div>
                      <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                        {item.locality}, {item.district} • Survey #{item.surveyNumber || 'Unassigned'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{item.extentCent} Cents</div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>
                        {item.extentSqFt.toLocaleString()} sq.ft • {item.landUsage}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.sellerName}</div>
                      <div style={{ fontSize: 11, color: item.isSellerVerified ? '#15803D' : '#B45309' }}>
                        {item.isSellerVerified ? '✓ Verified Title Owner' : 'Unverified Identity'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#065F46' }}>
                        {formatLakhs(item.askingRatePerCent)} / Cent
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Total: {formatLakhs(item.askingPriceTotal)}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {item.guidelineRatePerCent ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#1E40AF' }}>
                            {formatLakhs(item.guidelineRatePerCent)} / Cent
                          </div>
                          <div style={{ fontSize: 10, color: '#64748B' }}>TNREGINET Base</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>Not indexed</span>
                      )}
                    </td>

                    {/* Price Sanity Heuristic Ratio */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11,
                        background: ratio > 2.5 ? '#FEF2F2' : ratio < 0.6 ? '#FFFBEB' : '#F0FDF4',
                        color: ratio > 2.5 ? '#DC2626' : ratio < 0.6 ? '#B45309' : '#15803D',
                        border: `1px solid ${ratio > 2.5 ? '#FECACA' : ratio < 0.6 ? '#FDE68A' : '#BBF7D0'}`
                      }}>
                        {ratio.toFixed(2)}x Guideline
                        {ratio > 2.5 ? ' (Premium)' : ratio < 0.6 ? ' (Discount)' : ' (Healthy)'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 800,
                        background: isActive ? '#DCFCE7' : isPending ? '#FEF3C7' : '#FEE2E2',
                        color: isActive ? '#15803D' : isPending ? '#B45309' : '#DC2626',
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {isPending && (
                          <button
                            onClick={() => onApproveListing(item.id)}
                            style={{
                              background: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✓ Approve
                          </button>
                        )}
                        {!isRejected && (
                          <button
                            onClick={() => {
                              setRejectingId(item.id);
                              setRejectReason('');
                            }}
                            style={{
                              background: '#FFFFFF',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              padding: '5px 10px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reject...
                          </button>
                        )}
                        {isActive && (
                          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                            Published
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 8,
            padding: 24,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#0F172A', fontWeight: 800 }}>
              Reject Listing / Request Revisions
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#64748B' }}>
              State the specific legal or pricing discrepancy found during moderation review. This explanation will be delivered to the seller's workspace.
            </p>

            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Survey number 318/2B does not match uploaded Patta revenue sketch; please re-upload sub-division document."
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 12,
                color: '#0F172A',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setRejectingId(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                style={{
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
