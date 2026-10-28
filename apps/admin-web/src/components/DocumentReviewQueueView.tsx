import { useState } from 'react';
import { DocumentSubmission, DocumentStatus } from '@greenart/shared-types';

export interface DocumentReviewQueueViewProps {
  documents: DocumentSubmission[];
  onApproveDocument: (id: string, notes?: string) => void;
  onRejectDocument: (id: string, reason: string) => void;
}

export const DocumentReviewQueueView: React.FC<DocumentReviewQueueViewProps> = ({
  documents,
  onApproveDocument,
  onRejectDocument,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<string>('');

  const filtered = documents.filter((doc) => {
    if (filterStatus !== 'All' && doc.status !== filterStatus) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchFile = doc.fileName.toLowerCase().includes(q);
      const matchUploader = doc.uploaderName.toLowerCase().includes(q);
      const matchLoc = doc.locality ? doc.locality.toLowerCase().includes(q) : false;
      const matchSurvey = doc.surveyNumber ? doc.surveyNumber.toLowerCase().includes(q) : false;
      if (!matchFile && !matchUploader && !matchLoc && !matchSurvey) return false;
    }
    return true;
  });

  const handleConfirmReject = () => {
    if (!rejectingDocId) return;
    if (!rejectNotes.trim()) {
      alert('Please state a reason for document rejection.');
      return;
    }
    onRejectDocument(rejectingDocId, rejectNotes.trim());
    setRejectingDocId(null);
    setRejectNotes('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-block', background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              TITLE DUE DILIGENCE & AUDIT
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Legal Document Review Queue
            </h2>
            <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0 0' }}>
              Inspect and verify uploaded Patta, Chitta, SRO Registered Deeds, and FMB sketches. Only approved documents qualify associated transaction evidence for algorithmic market estimation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center', background: '#F8FAFC', padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                {documents.filter((d) => d.status === DocumentStatus.Pending).length}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Pending Review</div>
            </div>
            <div style={{ textAlign: 'center', background: '#F8FAFC', padding: '8px 16px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                {documents.filter((d) => d.status === DocumentStatus.Verified).length}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Verified & Indexed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <input
          type="text"
          placeholder="Search by file name, uploader, locality, or survey number..."
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
          {['All', DocumentStatus.Pending, DocumentStatus.Verified, DocumentStatus.Rejected].map((st) => (
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

      {/* Document Queue Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '12px 14px' }}>Document Details</th>
              <th style={{ padding: '12px 14px' }}>Document Type</th>
              <th style={{ padding: '12px 14px' }}>Uploader & Subject</th>
              <th style={{ padding: '12px 14px' }}>Extracted Metadata</th>
              <th style={{ padding: '12px 14px' }}>SHA-256 Checksum</th>
              <th style={{ padding: '12px 14px' }}>Status</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Auditor Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                  No documents found matching current filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((doc) => {
                const isVerified = doc.status === DocumentStatus.Verified;
                const isPending = doc.status === DocumentStatus.Pending;
                const isRejected = doc.status === DocumentStatus.Rejected;

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{doc.fileName}</div>
                      <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                        ID: {doc.id} • {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB • {new Date(doc.submittedAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#F1F5F9',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#334155',
                      }}>
                        {doc.documentType}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{doc.uploaderName}</div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>
                        {doc.locality ? `${doc.locality}, ${doc.district || 'TN'}` : 'Tamil Nadu'}
                        {doc.surveyNumber ? ` • Survey #${doc.surveyNumber}` : ''}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {doc.extractedMetadata ? (
                        <div style={{ fontSize: 11, color: '#334155' }}>
                          <div>Patta #{doc.extractedMetadata.pattaNumber || 'N/A'} • Sub: {doc.extractedMetadata.subDivision || 'Main'}</div>
                          <div style={{ color: '#64748B' }}>Owner: {doc.extractedMetadata.ownerName || 'Verified'} • {doc.extractedMetadata.extentCent ? `${doc.extractedMetadata.extentCent} Cents` : ''}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>Manual Audit Required</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <code style={{ fontSize: 10, background: '#F8FAFC', padding: '2px 4px', borderRadius: 4, color: '#475569', border: '1px solid #E2E8F0' }}>
                        {doc.fileChecksumSha256.slice(0, 14)}...
                      </code>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 800,
                        background: isVerified ? '#DCFCE7' : isPending ? '#FEF3C7' : '#FEE2E2',
                        color: isVerified ? '#15803D' : isPending ? '#B45309' : '#DC2626',
                      }}>
                        {doc.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {isPending && (
                          <button
                            onClick={() => onApproveDocument(doc.id, 'Verified against Tamil Nadu e-Services revenue records')}
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
                            ✓ Verify & Index
                          </button>
                        )}
                        {!isRejected && (
                          <button
                            onClick={() => {
                              setRejectingDocId(doc.id);
                              setRejectNotes('');
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
                        {isVerified && (
                          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                            Eligible for Valuation
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
      {rejectingDocId && (
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
              Reject Land Title Document
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#64748B' }}>
              Explain why this revenue document failed legal verification (e.g., illegible village seal, survey boundary discrepancy, or missing sub-division sketch).
            </p>

            <textarea
              rows={4}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Scanned Patta copy does not contain official Taluk seal or QR verification code."
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
                onClick={() => setRejectingDocId(null)}
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
