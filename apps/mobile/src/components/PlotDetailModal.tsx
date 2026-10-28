import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { MarketplaceListing, ListingEnquiry } from '@greenart/shared-types';

export interface PlotDetailModalProps {
  listing: MarketplaceListing | null;
  visible: boolean;
  onClose: () => void;
  onSubmitEnquiry: (enquiry: ListingEnquiry) => void;
  onOpenValuation?: (locality: string, coordinates: { latitude: number; longitude: number }) => void;
}

export const PlotDetailModal: React.FC<PlotDetailModalProps> = ({
  listing,
  visible,
  onClose,
  onSubmitEnquiry,
  onOpenValuation,
}) => {
  if (!listing) return null;

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerOffer, setBuyerOffer] = useState('');
  const [buyerMessage, setBuyerMessage] = useState('I am interested in inspecting this plot. Please share availability.');
  const [enquirySent, setEnquirySent] = useState(false);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const handleSendEnquiry = () => {
    if (!buyerName.trim() || !buyerPhone.trim()) {
      alert('Please provide your name and phone number to send an enquiry to the seller.');
      return;
    }

    const enquiry: ListingEnquiry = {
      id: `ENQ-${Date.now()}`,
      listingId: listing.id,
      listingTitle: listing.title,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      offeredPriceTotal: buyerOffer ? parseFloat(buyerOffer.replace(/[^0-9.]/g, '')) : undefined,
      message: buyerMessage.trim(),
      submittedAt: new Date().toISOString(),
    };

    onSubmitEnquiry(enquiry);
    setEnquirySent(true);
    setTimeout(() => {
      setEnquirySent(false);
      onClose();
    }, 2200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Navbar */}
        <View style={styles.topNav}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>
            {listing.locality} Plot #{listing.surveyNumber || 'Plot'}
          </Text>
          <View style={styles.placeholderRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Main Gallery */}
          <View style={styles.galleryContainer}>
            <Image
              source={{ uri: listing.images[activeImageIdx] || listing.images[0] }}
              style={styles.mainImage}
              resizeMode="cover"
            />
            {listing.images.length > 1 && (
              <View style={styles.thumbRow}>
                {listing.images.map((img, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setActiveImageIdx(idx)}
                    style={[styles.thumbBox, activeImageIdx === idx && styles.thumbBoxActive]}
                  >
                    <Image source={{ uri: img }} style={styles.thumbImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Title & Location Header */}
          <View style={styles.sectionCard}>
            <View style={styles.badgeRow}>
              <View style={styles.usageTag}>
                <Text style={styles.usageTagText}>{listing.landUsage.toUpperCase()}</Text>
              </View>
              {listing.isSellerVerified ? (
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>✓ Legally Verified Seller</Text>
                </View>
              ) : (
                <View style={styles.unverifiedTag}>
                  <Text style={styles.unverifiedTagText}>Unverified Seller</Text>
                </View>
              )}
            </View>

            <Text style={styles.plotTitle}>{listing.title}</Text>
            <Text style={styles.plotAddress}>
              {listing.streetAddress ? `${listing.streetAddress}, ` : ''}
              {listing.locality}, {listing.taluk ? `${listing.taluk} Taluk, ` : ''}
              {listing.district}, Tamil Nadu
            </Text>

            {listing.surveyNumber && (
              <View style={styles.surveyBox}>
                <Text style={styles.surveyLabel}>REVENUE SURVEY NUMBER</Text>
                <Text style={styles.surveyValue}>{listing.surveyNumber}</Text>
              </View>
            )}
          </View>

          {/* Plot Extent & Geometry Conversion */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Plot Dimensions & Land Extent</Text>
            <View style={styles.extentGrid}>
              <View style={styles.extentGridItem}>
                <Text style={styles.extentGridVal}>{listing.extentCent}</Text>
                <Text style={styles.extentGridUnit}>CENTS</Text>
              </View>
              <View style={styles.extentGridItem}>
                <Text style={styles.extentGridVal}>{listing.extentSqFt.toLocaleString()}</Text>
                <Text style={styles.extentGridUnit}>SQ. FEET</Text>
              </View>
              <View style={styles.extentGridItem}>
                <Text style={styles.extentGridVal}>{(listing.extentCent / 5.5).toFixed(2)}</Text>
                <Text style={styles.extentGridUnit}>GROUNDS</Text>
              </View>
              <View style={styles.extentGridItem}>
                <Text style={styles.extentGridVal}>{(listing.extentCent / 100).toFixed(3)}</Text>
                <Text style={styles.extentGridUnit}>ACRES</Text>
              </View>
            </View>

            <View style={styles.dimRow}>
              <Text style={styles.dimText}>
                Road Access: <Text style={styles.dimHighlight}>{listing.roadWidthFeet || 30} Feet Tar Road</Text>
              </Text>
              <Text style={styles.dimText}>
                Facing: <Text style={styles.dimHighlight}>{listing.facing || 'East'}</Text>
              </Text>
            </View>
          </View>

          {/* Statutory Pricing Transparency & Independence */}
          <View style={[styles.sectionCard, styles.transparencyCard]}>
            <View style={styles.transparencyHeader}>
              <Text style={styles.transparencyTitle}>Institutional Pricing Architecture</Text>
              <Text style={styles.transparencyNotice}>Segregated Data Sources</Text>
            </View>

            <View style={styles.priceComparisonBlock}>
              <View style={styles.priceCompRow}>
                <View>
                  <Text style={styles.compLabel}>1. Seller Asking Price (Total)</Text>
                  <Text style={styles.compSub}>Set directly by property owner</Text>
                </View>
                <View style={styles.compValBox}>
                  <Text style={styles.compValPrimary}>{formatCurrency(listing.askingPriceTotal)}</Text>
                  <Text style={styles.compValSecondary}>{formatCurrency(listing.askingRatePerCent)} / Cent</Text>
                </View>
              </View>

              <View style={styles.compDivider} />

              <View style={styles.priceCompRow}>
                <View>
                  <Text style={styles.compLabel}>2. TN Govt Guideline Rate</Text>
                  <Text style={styles.compSub}>Registration Dept statutory base</Text>
                </View>
                <View style={styles.compValBox}>
                  <Text style={styles.compValGovt}>
                    {listing.guidelineRatePerCent ? `${formatCurrency(listing.guidelineRatePerCent)} / Cent` : 'N/A'}
                  </Text>
                  <Text style={styles.compValSecondary}>
                    {listing.guidelineRatePerSqFt ? `₹${listing.guidelineRatePerSqFt} / sq.ft` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.compDivider} />

              <View style={styles.priceCompRow}>
                <View>
                  <Text style={styles.compLabel}>3. Greenart Algorithmic Median</Text>
                  <Text style={styles.compSub}>Calculated from verified deed evidence</Text>
                </View>
                <View style={styles.compValBox}>
                  <Text style={styles.compValGreenart}>
                    {listing.estimatedMarketMedianPerCent ? `${formatCurrency(listing.estimatedMarketMedianPerCent)} / Cent` : 'In Review'}
                  </Text>
                  <Text style={styles.compValSecondary}>Filtered outlier bounds</Text>
                </View>
              </View>
            </View>

            <View style={styles.legalDisclaimerBox}>
              <Text style={styles.legalDisclaimerText}>
                Statutory Notice: Government guideline values represent minimum statutory valuations for stamp duty registration under the Indian Stamp Act (Tamil Nadu). They are independent of seller asking prices and actual market considerations. Greenart maintains strict segregation between asking rates and registered transactions.
              </Text>
            </View>

            {onOpenValuation && (
              <TouchableOpacity
                style={styles.runValuationBtn}
                onPress={() => {
                  onClose();
                  onOpenValuation(listing.locality, listing.coordinates);
                }}
              >
                <Text style={styles.runValuationBtnText}>Run Custom Valuation Radius for This Plot →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Verified Document Vault Checklist */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Submitted Legal & Title Documents</Text>
            <Text style={styles.sectionSubtitle}>
              Documents uploaded by seller for institutional due diligence review:
            </Text>

            <View style={styles.docList}>
              {listing.documentsAvailable.map((doc, idx) => (
                <View key={idx} style={styles.docItemRow}>
                  <View style={[styles.docStatusDot, doc.verified ? styles.docDotGreen : styles.docDotAmber]} />
                  <View style={styles.docItemDetails}>
                    <Text style={styles.docItemTitle}>{doc.documentName}</Text>
                    <Text style={styles.docItemSub}>
                      Type: {doc.type} • Status: {doc.verified ? 'Verified by Revenue Auditor' : 'Under Review'}
                    </Text>
                  </View>
                  <View style={[styles.docBadge, doc.verified ? styles.docBadgeVerified : styles.docBadgePending]}>
                    <Text style={[styles.docBadgeText, doc.verified ? styles.docBadgeTextVerified : styles.docBadgeTextPending]}>
                      {doc.verified ? 'VERIFIED' : 'PENDING'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Property Description</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>

          {/* Seller Information */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Seller Profile</Text>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>{listing.sellerName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.sellerDetails}>
                <Text style={styles.sellerName}>{listing.sellerName}</Text>
                <Text style={styles.sellerType}>
                  Role: {listing.sellerType === 'IndividualOwner' ? 'Direct Property Owner' : listing.sellerType}
                </Text>
                {listing.sellerPhone && (
                  <Text style={styles.sellerContact}>Direct Contact: {listing.sellerPhone}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Direct Enquiry Form */}
          <View style={[styles.sectionCard, styles.enquiryCard]}>
            <Text style={styles.enquiryCardTitle}>Connect With Seller / Schedule Inspection</Text>
            <Text style={styles.enquiryCardSub}>
              Send a direct verified enquiry without broker intermediation.
            </Text>

            {enquirySent ? (
              <View style={styles.enquirySuccessBox}>
                <Text style={styles.enquirySuccessTitle}>✓ Enquiry Sent Successfully</Text>
                <Text style={styles.enquirySuccessMsg}>
                  Your contact details and message have been routed to the verified owner ({listing.sellerName}).
                </Text>
              </View>
            ) : (
              <View style={styles.enquiryForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>YOUR FULL NAME *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. S. Ramanathan"
                    placeholderTextColor="#94A3B8"
                    value={buyerName}
                    onChangeText={setBuyerName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PHONE NUMBER (FOR CALL / WHATSAPP) *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="+91 98400 12345"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={buyerPhone}
                    onChangeText={setBuyerPhone}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>OFFER PRICE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={`e.g. ${formatCurrency(listing.askingPriceTotal)}`}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={buyerOffer}
                    onChangeText={setBuyerOffer}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>MESSAGE TO OWNER</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    multiline
                    numberOfLines={3}
                    placeholder="Enter your inspection date or question..."
                    placeholderTextColor="#94A3B8"
                    value={buyerMessage}
                    onChangeText={setBuyerMessage}
                  />
                </View>

                <TouchableOpacity style={styles.sendEnquiryBtn} onPress={handleSendEnquiry} activeOpacity={0.85}>
                  <Text style={styles.sendEnquiryBtnText}>Submit Direct Enquiry →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topNav: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: 220,
  },
  placeholderRight: {
    width: 60,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  galleryContainer: {
    backgroundColor: '#0F172A',
  },
  mainImage: {
    width: '100%',
    height: 240,
  },
  thumbRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    backgroundColor: '#0F172A',
  },
  thumbBox: {
    width: 60,
    height: 44,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBoxActive: {
    borderColor: '#D4AF37',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  usageTag: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  usageTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedTag: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  unverifiedTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  unverifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  plotTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 6,
  },
  plotAddress: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  surveyBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  surveyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  surveyValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#240046',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  extentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  extentGridItem: {
    alignItems: 'center',
    flex: 1,
  },
  extentGridVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#240046',
  },
  extentGridUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  dimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
  },
  dimText: {
    fontSize: 12,
    color: '#64748B',
  },
  dimHighlight: {
    fontWeight: '700',
    color: '#0F172A',
  },
  transparencyCard: {
    borderColor: '#D4AF37',
    backgroundColor: '#FAF5FF',
  },
  transparencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transparencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#240046',
  },
  transparencyNotice: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  priceComparisonBlock: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  priceCompRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  compLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  compSub: {
    fontSize: 10,
    color: '#64748B',
  },
  compValBox: {
    alignItems: 'flex-end',
  },
  compValPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#240046',
  },
  compValGovt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  compValGreenart: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  compValSecondary: {
    fontSize: 10,
    color: '#64748B',
  },
  compDivider: {
    height: 1,
    backgroundColor: '#FAF5FF',
    marginVertical: 4,
  },
  legalDisclaimerBox: {
    backgroundColor: '#FAF5FF',
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    marginBottom: 12,
  },
  legalDisclaimerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#475569',
  },
  runValuationBtn: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  runValuationBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  docList: {
    gap: 8,
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  docDotGreen: {
    backgroundColor: '#16A34A',
  },
  docDotAmber: {
    backgroundColor: '#D97706',
  },
  docItemDetails: {
    flex: 1,
  },
  docItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  docItemSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  docBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docBadgeVerified: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  docBadgePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  docBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  docBadgeTextVerified: {
    color: '#B45309',
  },
  docBadgeTextPending: {
    color: '#B45309',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#240046',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sellerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sellerType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  sellerContact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#240046',
    marginTop: 2,
  },
  enquiryCard: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  enquiryCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  enquiryCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  enquiryForm: {
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  formTextArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  sendEnquiryBtn: {
    backgroundColor: '#240046',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  sendEnquiryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  enquirySuccessBox: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  enquirySuccessTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#240046',
    marginBottom: 4,
  },
  enquirySuccessMsg: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

