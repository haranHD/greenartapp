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
  const [selectedDossierListing, setSelectedDossierListing] = useState<MarketplaceListing | null>(null);

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
    <div className="operations-view" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div className="operations-heading" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              LISTING REVIEW
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Review property listings
            </h2>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0 0' }}>
              Review the property details, seller information and asking price before publishing a listing.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <input
          type="text"
          aria-label="Search listing reviews"
          placeholder="Filter by plot title, locality, seller, or survey number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            padding: '8px 12px',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            fontSize: 13,
            color: '#0F172A',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['All', ListingStatus.PendingReview, ListingStatus.Active, ListingStatus.Rejected].map((st) => (
            <button
              key={st}
              aria-pressed={filterStatus === st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: filterStatus === st ? '1px solid #065F46' : '1px solid #CBD5E1',
                background: filterStatus === st ? '#240046' : '#FFFFFF',
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
      <div role="region" aria-label="ListingModeration table" tabIndex={0} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
        <table style={{ minWidth: 760, width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
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
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.sellerName}</div>
                      <div style={{ fontSize: 11, color: item.isSellerVerified ? '#15803D' : '#B45309', marginBottom: 3 }}>
                        {item.isSellerVerified ? '✓ Verified Title Owner' : 'Direct Mobile Seller'}
                      </div>
                      {item.sellerPhone && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          <a href={`tel:${item.sellerPhone}`} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
                            📞 {item.sellerPhone}
                          </a>
                        </div>
                      )}
                      {item.sellerEmail && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          <a href={`mailto:${item.sellerEmail}`} style={{ color: '#475569', textDecoration: 'none' }}>
                            ✉️ {item.sellerEmail}
                          </a>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, fontFamily: 'monospace' }}>
                        ID: {item.sellerId ? (item.sellerId.length > 13 ? `${item.sellerId.substring(0, 8)}...` : item.sellerId) : 'N/A'}
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
                      <div style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11,
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedDossierListing(item)}
                          style={{
                            background: '#F8FAFC',
                            color: '#334155',
                            border: '1px solid #CBD5E1',
                            padding: '5px 9px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Inspect complete seller dossier and plot specifications"
                        >
                          🔍 Dossier
                        </button>
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

      {/* Seller & Plot Dossier Inspection Modal */}
      {selectedDossierListing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 12,
            maxWidth: 780,
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}>
            {/* Dossier Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: '#240046',
                    color: '#FFD700',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}>
                    SELLER & PLOT DOSSIER
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: selectedDossierListing.status === ListingStatus.Active ? '#DCFCE7' : selectedDossierListing.status === ListingStatus.PendingReview ? '#FEF3C7' : '#FEE2E2',
                    color: selectedDossierListing.status === ListingStatus.Active ? '#15803D' : selectedDossierListing.status === ListingStatus.PendingReview ? '#B45309' : '#DC2626',
                  }}>
                    {selectedDossierListing.status.toUpperCase()}
                  </span>
                </div>
                <h3 style={{ margin: '6px 0 0 0', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                  {selectedDossierListing.title}
                </h3>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Listing ID: <code style={{ color: '#334155' }}>{selectedDossierListing.id}</code>
                </div>
              </div>

              <button
                onClick={() => setSelectedDossierListing(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Dossier Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Grid with 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {/* Card 1: Verified Seller Information */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>👤</span> Verified Seller Information
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Seller Full Name</div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>{selectedDossierListing.sellerName}</div>
                      <div style={{ fontSize: 11, color: selectedDossierListing.isSellerVerified ? '#15803D' : '#B45309', fontWeight: 600 }}>
                        {selectedDossierListing.isSellerVerified ? '✓ Verified Title Owner' : 'Direct Mobile Submission'}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Phone Contact</div>
                        {selectedDossierListing.sellerPhone ? (
                          <a href={`tel:${selectedDossierListing.sellerPhone}`} style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none' }}>
                            📞 {selectedDossierListing.sellerPhone}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Not provided</span>
                        )}
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Email Address</div>
                        {selectedDossierListing.sellerEmail ? (
                          <a href={`mailto:${selectedDossierListing.sellerEmail}`} style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                            ✉️ {selectedDossierListing.sellerEmail}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Not provided</span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 4 }}>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Account / Seller ID</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>
                        {selectedDossierListing.sellerId}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Property Extent & Specifications */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📐</span> Land Extent & Physical Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Extent in Cents</div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 14 }}>{selectedDossierListing.extentCent} Cents</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Square Feet</div>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{selectedDossierListing.extentSqFt?.toLocaleString()} sq.ft</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Land Classification</div>
                      <div style={{ fontWeight: 700, color: '#240046' }}>{selectedDossierListing.landUsage}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Road Width & Facing</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{selectedDossierListing.roadWidthFeet || 30} ft • {selectedDossierListing.facing || 'East'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid 2: Location & Pricing */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {/* Card 3: Location & Revenue Details */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📍</span> Revenue & Location Record
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Locality / Taluk / District</div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>
                        {selectedDossierListing.locality}{selectedDossierListing.taluk ? `, ${selectedDossierListing.taluk}` : ''}, {selectedDossierListing.district}, {selectedDossierListing.state}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Survey Number</div>
                        <div style={{ fontWeight: 700, color: '#1E40AF' }}>
                          {selectedDossierListing.surveyNumber || 'Unassigned / Not Specified'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>GPS Coordinates</div>
                        <a
                          href={`https://www.google.com/maps?q=${selectedDossierListing.coordinates.latitude},${selectedDossierListing.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                        >
                          🌐 {selectedDossierListing.coordinates.latitude.toFixed(4)}, {selectedDossierListing.coordinates.longitude.toFixed(4)} ↗
                        </a>
                      </div>
                    </div>

                    {selectedDossierListing.streetAddress && (
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Street Address</div>
                        <div style={{ color: '#334155' }}>{selectedDossierListing.streetAddress}</div>
                      </div>
                    )}

                    {selectedDossierListing.documentsAvailable && selectedDossierListing.documentsAvailable.length > 0 && (
                      <div>
                        <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                          Declared Legal Documents ({selectedDossierListing.documentsAvailable.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {selectedDossierListing.documentsAvailable.map((doc, idx) => (
                            <span key={idx} style={{
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#065F46',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                            }}>
                              📄 {doc.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 4: Financial Benchmark & Price Sanity */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💰</span> Financials & Guideline Benchmark
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Total Asking Price</div>
                      <div style={{ fontWeight: 800, color: '#065F46', fontSize: 16 }}>
                        {formatLakhs(selectedDossierListing.askingPriceTotal)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Asking Rate / Cent</div>
                      <div style={{ fontWeight: 700, color: '#065F46' }}>
                        {formatLakhs(selectedDossierListing.askingRatePerCent)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>
                        ₹{selectedDossierListing.askingRatePerSqFt?.toLocaleString()} / sq.ft
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>TNREGINET Benchmark</div>
                      <div style={{ fontWeight: 700, color: '#1E40AF' }}>
                        {selectedDossierListing.guidelineRatePerCent ? formatLakhs(selectedDossierListing.guidelineRatePerCent) : 'Not indexed'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Price Sanity Ratio</div>
                      {(() => {
                        const ratio = selectedDossierListing.guidelineRatePerCent && selectedDossierListing.guidelineRatePerCent > 0
                          ? selectedDossierListing.askingRatePerCent / selectedDossierListing.guidelineRatePerCent
                          : 1.0;
                        return (
                          <div style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: 11,
                            background: ratio > 2.5 ? '#FEF2F2' : ratio < 0.6 ? '#FFFBEB' : '#F0FDF4',
                            color: ratio > 2.5 ? '#DC2626' : ratio < 0.6 ? '#B45309' : '#15803D',
                            border: `1px solid ${ratio > 2.5 ? '#FECACA' : ratio < 0.6 ? '#FDE68A' : '#BBF7D0'}`,
                            marginTop: 2,
                          }}>
                            {ratio.toFixed(2)}x Guideline
                            {ratio > 2.5 ? ' (Premium)' : ratio < 0.6 ? ' (Discount)' : ' (Healthy)'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedDossierListing.description && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                    Property Description
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                    {selectedDossierListing.description}
                  </div>
                </div>
              )}
            </div>

            {/* Dossier Footer / Actions */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <button
                onClick={() => setSelectedDossierListing(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  padding: '7px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Dossier
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedDossierListing.status !== ListingStatus.Rejected && (
                  <button
                    onClick={() => {
                      const id = selectedDossierListing.id;
                      setSelectedDossierListing(null);
                      setRejectingId(id);
                      setRejectReason('');
                    }}
                    style={{
                      background: '#FFFFFF',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Reject Listing...
                  </button>
                )}

                {selectedDossierListing.status === ListingStatus.PendingReview && (
                  <button
                    onClick={() => {
                      const id = selectedDossierListing.id;
                      setSelectedDossierListing(null);
                      onApproveListing(id);
                    }}
                    style={{
                      background: '#059669',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '7px 16px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Approve & Publish to Marketplace
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
