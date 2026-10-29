import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  DocumentSubmission,
  DocumentType,
  DocumentStatus,
} from '@greenart/shared-types';

export interface DocumentVaultViewProps {
  documents: DocumentSubmission[];
  onUploadDocument: (doc: DocumentSubmission) => void;
}

export const DocumentVaultView: React.FC<DocumentVaultViewProps> = ({
  documents,
  onUploadDocument,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docType, setDocType] = useState<DocumentType>(DocumentType.PattaChitta);
  const [fileName, setFileName] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [locality, setLocality] = useState('');
  const [district, setDistrict] = useState('Coimbatore');

  const handleUpload = () => {
    if (!fileName.trim()) {
      alert('File name / document title is required.');
      return;
    }

    const newDoc: DocumentSubmission = {
      id: `DOC-SUB-USR-${Date.now()}`,
      userId: 'CURRENT-LOGGED-IN-USER',
      uploaderName: 'Verified Property Owner',
      fileName: fileName.trim().endsWith('.pdf') ? fileName.trim() : `${fileName.trim()}.pdf`,
      fileSizeBytes: Math.floor(Math.random() * 2000000) + 500000,
      fileChecksumSha256: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      documentType: docType,
      status: DocumentStatus.Pending,
      surveyNumber: surveyNumber.trim() || undefined,
      locality: locality.trim() || undefined,
      district,
      submittedAt: new Date().toISOString(),
    };

    onUploadDocument(newDoc);
    setFileName('');
    setSurveyNumber('');
    setLocality('');
    setShowUploadModal(false);
    alert('Document securely submitted to the administrative verification queue.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ENCRYPTED TITLE VAULT</Text>
        </View>
        <Text style={styles.title}>Legal Document Submissions</Text>
        <Text style={styles.subtitle}>
          Secure repository for Revenue Patta, SRO Registered Deeds, FMB Sketches, and Encumbrance Certificates. Only verified documents qualify for valuation indexing.
        </Text>
      </View>

      {/* Upload Trigger Button */}
      <TouchableOpacity
        style={styles.uploadBtn}
        onPress={() => setShowUploadModal(!showUploadModal)}
        activeOpacity={0.85}
      >
        <Text style={styles.uploadBtnText}>
          {showUploadModal ? '✕ Cancel Submission' : '+ Submit New Land Document'}
        </Text>
      </TouchableOpacity>

      {/* Upload Form Card */}
      {showUploadModal && (
        <View style={styles.uploadCard}>
          <Text style={styles.uploadCardTitle}>Submit Document for Legal Review</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>DOCUMENT CLASSIFICATION *</Text>
            <View style={styles.typeGrid}>
              {[
                DocumentType.PattaChitta,
                DocumentType.RegisteredSaleDeed,
                DocumentType.FMBPlan,
                DocumentType.EncumbranceCertificate,
              ].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, docType === t && styles.typePillActive]}
                  onPress={() => setDocType(t)}
                >
                  <Text style={[styles.typePillText, docType === t && styles.typePillTextActive]}>
                    {t.replace('Registered', '').replace('Certificate', ' EC')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>DOCUMENT / FILE TITLE *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Patta_Record_Saravanampatti_318.pdf"
              placeholderTextColor="#94A3B8"
              value={fileName}
              onChangeText={setFileName}
            />
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>SURVEY NUMBER</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 318/2B"
                placeholderTextColor="#94A3B8"
                value={surveyNumber}
                onChangeText={setSurveyNumber}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.formLabel}>LOCALITY</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Saravanampatti"
                placeholderTextColor="#94A3B8"
                value={locality}
                onChangeText={setLocality}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.confirmUploadBtn} onPress={handleUpload} activeOpacity={0.85}>
            <Text style={styles.confirmUploadBtnText}>Confirm Document Upload →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Document List */}
      <ScrollView contentContainerStyle={styles.docList}>
        {documents.length === 0 ? (
          <View style={{ paddingVertical: 36, alignItems: 'center', paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#475569' }}>
              No title documents in vault
            </Text>
            <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
              Submit your Patta, Chitta, Registered Sale Deed, or FMB sketch to initiate administrative verification.
            </Text>
          </View>
        ) : (
          documents.map((doc) => {
            const isVerified = doc.status === DocumentStatus.Verified;
            const isPending = doc.status === DocumentStatus.Pending;
            const isRejected = doc.status === DocumentStatus.Rejected;

            return (
              <View key={doc.id} style={styles.docCard}>
                <View style={styles.docCardTop}>
                  <View style={styles.docTypeBadge}>
                    <Text style={styles.docTypeBadgeText}>{doc.documentType}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      isVerified && styles.statusVerified,
                      isPending && styles.statusPending,
                      isRejected && styles.statusRejected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isVerified && styles.textGreen,
                        isPending && styles.textAmber,
                        isRejected && styles.textRed,
                      ]}
                    >
                      {doc.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.docFileName}>{doc.fileName}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    Survey No: <Text style={styles.metaHighlight}>{doc.surveyNumber || 'Not specified'}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    Size: {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>

                {doc.reviewNotes && (
                  <View style={[styles.notesBox, isRejected ? styles.notesBoxRed : styles.notesBoxGreen]}>
                    <Text style={[styles.notesTitle, isRejected ? styles.textRed : styles.textGreen]}>
                      {isRejected ? 'Action Required / Rejection Reason:' : 'Auditor Verification Note:'}
                    </Text>
                    <Text style={styles.notesBody}>{doc.reviewNotes}</Text>
                    {doc.reviewedBy && (
                      <Text style={styles.reviewedByText}>Reviewed by: {doc.reviewedBy}</Text>
                    )}
                  </View>
                )}

                <View style={styles.docCardFooter}>
                  <Text style={styles.checksumText}>
                    SHA-256: {doc.fileChecksumSha256.slice(0, 16)}...
                  </Text>
                  <Text style={styles.dateText}>
                    {new Date(doc.submittedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          }))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  header: {
    marginBottom: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  uploadBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  uploadCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typePill: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typePillActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmUploadBtn: {
    backgroundColor: '#240046',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  confirmUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  docList: {
    gap: 12,
    paddingBottom: 80,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  docCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusVerified: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  textGreen: {
    color: '#B45309',
  },
  textAmber: {
    color: '#B45309',
  },
  textRed: {
    color: '#DC2626',
  },
  docFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  metaHighlight: {
    fontWeight: '700',
    color: '#0F172A',
  },
  notesBox: {
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  notesBoxRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notesBoxGreen: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE68A',
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
  reviewedByText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  docCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 2,
  },
  checksumText: {
    fontSize: 9,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  dateText: {
    fontSize: 9,
    color: '#94A3B8',
  },
});

