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
  MarketplaceListing,
  ListingStatus,
  SellerType,
  LandUsageType,
  DocumentType,
} from '@greenart/shared-types';

export interface SellLandFlowViewProps {
  userListings: MarketplaceListing[];
  onSaveListing: (listing: MarketplaceListing) => void;
  onSelectListing: (listing: MarketplaceListing) => void;
}

export const SellLandFlowView: React.FC<SellLandFlowViewProps> = ({
  userListings,
  onSaveListing,
  onSelectListing,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'workspace'>('workspace');

  // Form States for New Listing
  const [district, setDistrict] = useState('Coimbatore');
  const [taluk, setTaluk] = useState('');
  const [locality, setLocality] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [landUsage, setLandUsage] = useState<LandUsageType>(LandUsageType.Residential);
  const [extentCent, setExtentCent] = useState('');
  const [roadWidthFeet, setRoadWidthFeet] = useState('30');
  const [facing, setFacing] = useState('North');
  const [askingPriceTotal, setAskingPriceTotal] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<{ [key in DocumentType]?: boolean }>({
    [DocumentType.PattaChitta]: true,
    [DocumentType.RegisteredSaleDeed]: true,
  });

  const parsedExtent = parseFloat(extentCent) || 0;
  const parsedTotal = parseFloat(askingPriceTotal) || 0;
  const computedRatePerCent = parsedExtent > 0 ? Math.round(parsedTotal / parsedExtent) : 0;
  const computedExtentSqFt = Math.round(parsedExtent * 435.6);

  const handleToggleDoc = (docType: DocumentType) => {
    setSelectedDocs((prev) => ({
      ...prev,
      [docType]: !prev[docType],
    }));
  };

  const handleSubmitListing = (status: ListingStatus) => {
    if (!locality.trim()) {
      alert('Locality is required.');
      return;
    }
    if (parsedExtent <= 0) {
      alert('Please enter a valid land extent in Cents.');
      return;
    }
    if (parsedTotal <= 0) {
      alert('Please enter a valid total asking price.');
      return;
    }

    const newListing: MarketplaceListing = {
      id: `LIST-TN-USR-${Date.now()}`,
      title: `${parsedExtent} Cents ${landUsage} Plot in ${locality}`,
      description: description.trim() || `Clear title ${landUsage.toLowerCase()} plot in ${locality}, ${district}. Extent: ${parsedExtent} Cents (${computedExtentSqFt} sq.ft). Road width: ${roadWidthFeet} ft.`,
      sellerId: 'CURRENT-LOGGED-IN-USER',
      sellerName: 'My Account (Verified Owner)',
      sellerType: SellerType.IndividualOwner,
      isSellerVerified: true,
      state: 'Tamil Nadu',
      district,
      taluk: taluk.trim() || undefined,
      locality: locality.trim(),
      streetAddress: streetAddress.trim() || undefined,
      surveyNumber: surveyNumber.trim() || undefined,
      coordinates: { latitude: 11.0168, longitude: 76.9558 }, // Default regional anchor
      landUsage,
      extentCent: parsedExtent,
      extentSqFt: computedExtentSqFt,
      roadWidthFeet: parseFloat(roadWidthFeet) || 30,
      facing,
      askingPriceTotal: parsedTotal,
      askingRatePerCent: computedRatePerCent,
      askingRatePerSqFt: Math.round(computedRatePerCent / 435.6),
      guidelineRatePerCent: Math.round(computedRatePerCent * 0.72), // Indicative baseline
      status,
      images: [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80',
      ],
      documentsAvailable: Object.entries(selectedDocs)
        .filter(([_, sel]) => sel)
        .map(([type]) => ({
          type: type as DocumentType,
          verified: false, // New submissions start as unreviewed until admin audit
          documentName: `${type}_${surveyNumber || 'Plot'}.pdf`,
          surveyNumber: surveyNumber.trim() || undefined,
        })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveListing(newListing);
    setActiveSubTab('workspace');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>LAND OWNER WORKSPACE</Text>
        </View>
        <Text style={styles.title}>Sell Land & Track Plots</Text>
        <Text style={styles.subtitle}>
          Direct institutional marketplace. List your plot with genuine survey numbers and title documents for verified buyers.
        </Text>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.subTabRow}>
        <TouchableOpacity
          style={[styles.subTabBtn, activeSubTab === 'workspace' && styles.subTabBtnActive]}
          onPress={() => setActiveSubTab('workspace')}
        >
          <Text style={[styles.subTabBtnText, activeSubTab === 'workspace' && styles.subTabBtnTextActive]}>
            My Listings ({userListings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeSubTab === 'create' && styles.subTabBtnActive]}
          onPress={() => setActiveSubTab('create')}
        >
          <Text style={[styles.subTabBtnText, activeSubTab === 'create' && styles.subTabBtnTextActive]}>
            + Post New Plot
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'workspace' ? (
        /* Workspace Screen */
        <View style={styles.workspaceBox}>
          {userListings.length === 0 ? (
            <View style={styles.emptyWorkspace}>
              <Text style={styles.emptyTitle}>No land plots listed yet</Text>
              <Text style={styles.emptyMsg}>
                Post your land plot with survey numbers and title documents to connect with serious institutional and retail buyers.
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => setActiveSubTab('create')}
              >
                <Text style={styles.ctaButtonText}>+ Create First Plot Listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listingStack}>
              {userListings.map((item) => {
                const isPending = item.status === ListingStatus.PendingReview;
                const isActive = item.status === ListingStatus.Active;
                const isDraft = item.status === ListingStatus.Draft;
                const isRejected = item.status === ListingStatus.Rejected;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.listingCard}
                    onPress={() => onSelectListing(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.listingTopRow}>
                      <Text style={styles.listingLocality}>{item.locality}, {item.district}</Text>
                      <View
                        style={[
                          styles.statusTag,
                          isActive && styles.statusTagActive,
                          isPending && styles.statusTagPending,
                          isDraft && styles.statusTagDraft,
                          isRejected && styles.statusTagRejected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            isActive && styles.statusTextGreen,
                            isPending && styles.statusTextAmber,
                            isDraft && styles.statusTextGray,
                            isRejected && styles.statusTextRed,
                          ]}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.listingTitle}>{item.title}</Text>

                    <View style={styles.listingMetricsRow}>
                      <View>
                        <Text style={styles.metricLabel}>EXTENT</Text>
                        <Text style={styles.metricValue}>{item.extentCent} Cents</Text>
                      </View>
                      <View>
                        <Text style={styles.metricLabel}>ASKING RATE</Text>
                        <Text style={styles.metricValue}>₹{(item.askingRatePerCent / 100000).toFixed(2)} L / Cent</Text>
                      </View>
                      <View>
                        <Text style={styles.metricLabel}>TOTAL VALUE</Text>
                        <Text style={styles.metricValueGreen}>₹{(item.askingPriceTotal / 100000).toFixed(2)} L</Text>
                      </View>
                    </View>

                    {item.rejectionReason && (
                      <View style={styles.rejectionNotice}>
                        <Text style={styles.rejectionTitle}>Reviewer Feedback:</Text>
                        <Text style={styles.rejectionMsg}>{item.rejectionReason}</Text>
                      </View>
                    )}

                    <View style={styles.listingFooterRow}>
                      <Text style={styles.footerDocsText}>
                        {item.documentsAvailable.length} legal document{item.documentsAvailable.length === 1 ? '' : 's'} attached
                      </Text>
                      <Text style={styles.footerActionText}>Manage Listing →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* Form: Post New Plot */
        <View style={styles.formContainer}>
          {/* Section 1: Location & Revenue Coordinates */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>1. Revenue & Location Identifiers</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DISTRICT (TAMIL NADU) *</Text>
              <TextInput
                style={styles.textInput}
                value={district}
                onChangeText={setDistrict}
                placeholder="e.g. Coimbatore, Erode, Tiruppur"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LOCALITY / VILLAGE *</Text>
                <TextInput
                  style={styles.textInput}
                  value={locality}
                  onChangeText={setLocality}
                  placeholder="e.g. Saravanampatti"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>TALUK</Text>
                <TextInput
                  style={styles.textInput}
                  value={taluk}
                  onChangeText={setTaluk}
                  placeholder="e.g. Annur"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>REVENUE SURVEY NUMBER</Text>
                <TextInput
                  style={styles.textInput}
                  value={surveyNumber}
                  onChangeText={setSurveyNumber}
                  placeholder="e.g. 318/2B"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>STREET / LANDMARK</Text>
                <TextInput
                  style={styles.textInput}
                  value={streetAddress}
                  onChangeText={setStreetAddress}
                  placeholder="e.g. Near Bus Stand"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* Section 2: Land Extent & Usage */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>2. Land Extent & Usage</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LAND USAGE TYPE</Text>
              <View style={styles.usagePills}>
                {[LandUsageType.Residential, LandUsageType.Commercial, LandUsageType.AgriculturalWet].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.usagePill, landUsage === u && styles.usagePillActive]}
                    onPress={() => setLandUsage(u)}
                  >
                    <Text style={[styles.usagePillText, landUsage === u && styles.usagePillTextActive]}>
                      {u === 'AgriculturalWet' ? 'Agricultural' : u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>EXTENT IN CENTS *</Text>
                <TextInput
                  style={styles.textInput}
                  value={extentCent}
                  onChangeText={setExtentCent}
                  placeholder="e.g. 5.5"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                {parsedExtent > 0 && (
                  <Text style={styles.helperText}>≈ {computedExtentSqFt.toLocaleString()} Sq.Ft</Text>
                )}
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>ROAD WIDTH (FEET)</Text>
                <TextInput
                  style={styles.textInput}
                  value={roadWidthFeet}
                  onChangeText={setRoadWidthFeet}
                  placeholder="e.g. 30"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Section 3: Commercial Pricing */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>3. Pricing Architecture</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TOTAL SELLER ASKING PRICE (INR) *</Text>
              <TextInput
                style={styles.textInput}
                value={askingPriceTotal}
                onChangeText={setAskingPriceTotal}
                placeholder="e.g. 4950000 (49.5 Lakhs)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>

            {computedRatePerCent > 0 && (
              <View style={styles.calculatedRateCard}>
                <Text style={styles.calcRateLabel}>COMPUTED ASKING RATE PER CENT</Text>
                <Text style={styles.calcRateValue}>₹{computedRatePerCent.toLocaleString('en-IN')} / Cent</Text>
                <Text style={styles.calcRateSub}>
                  ≈ ₹{Math.round(computedRatePerCent / 435.6).toLocaleString('en-IN')} / sq.ft
                </Text>
              </View>
            )}
          </View>

          {/* Section 4: Title Documents Checklist */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>4. Title & Revenue Proof Documents</Text>
            <Text style={styles.docNotice}>
              Select the documents you are attaching. Uploading valid Patta and Sale Deed records speeds up verification from 48h to under 4h.
            </Text>

            <View style={styles.docCheckboxList}>
              {[
                { type: DocumentType.PattaChitta, label: 'Patta / Chitta Revenue Record' },
                { type: DocumentType.RegisteredSaleDeed, label: 'Registered Sale Deed Copy' },
                { type: DocumentType.FMBPlan, label: 'Field Measurement Book (FMB) Sketch' },
                { type: DocumentType.EncumbranceCertificate, label: 'Encumbrance Certificate (EC)' },
              ].map((doc) => {
                const isSelected = !!selectedDocs[doc.type];
                return (
                  <TouchableOpacity
                    key={doc.type}
                    style={[styles.docCheckRow, isSelected && styles.docCheckRowSelected]}
                    onPress={() => handleToggleDoc(doc.type)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.docCheckLabel, isSelected && styles.docCheckLabelSelected]}>
                      {doc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 5: Description */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>5. Description & Highlights</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Mention proximity to arterial roads, water source, zoning clearance..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => handleSubmitListing(ListingStatus.PendingReview)}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Submit for Title Verification & Publish →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.draftBtn}
              onPress={() => handleSubmitListing(ListingStatus.Draft)}
              activeOpacity={0.8}
            >
              <Text style={styles.draftBtnText}>Save as Private Draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 16,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  subTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  subTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabBtnTextActive: {
    color: '#240046',
    fontWeight: '700',
  },
  workspaceBox: {
    gap: 12,
  },
  emptyWorkspace: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyMsg: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#240046',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listingStack: {
    gap: 12,
  },
  listingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  listingLocality: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagActive: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusTagPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusTagDraft: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  statusTagRejected: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTextGreen: {
    color: '#B45309',
  },
  statusTextAmber: {
    color: '#B45309',
  },
  statusTextGray: {
    color: '#475569',
  },
  statusTextRed: {
    color: '#DC2626',
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  listingMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricValueGreen: {
    fontSize: 12,
    fontWeight: '800',
    color: '#240046',
  },
  rejectionNotice: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  rejectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  rejectionMsg: {
    fontSize: 11,
    color: '#991B1B',
  },
  listingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
  },
  footerDocsText: {
    fontSize: 11,
    color: '#64748B',
  },
  footerActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },
  formContainer: {
    gap: 14,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 14,
    gap: 10,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  helperText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
    marginTop: 2,
  },
  usagePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  usagePill: {
    flex: 1,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  usagePillActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  usagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  usagePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calculatedRateCard: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  calcRateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  calcRateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#240046',
  },
  calcRateSub: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 2,
  },
  docNotice: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  docCheckboxList: {
    gap: 8,
  },
  docCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  docCheckRowSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#FAF5FF',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  docCheckLabel: {
    fontSize: 12,
    color: '#334155',
  },
  docCheckLabelSelected: {
    fontWeight: '700',
    color: '#240046',
  },
  buttonStack: {
    gap: 10,
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: '#240046',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  draftBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
});

