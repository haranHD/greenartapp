import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';
import { DocumentVaultView } from '../components/DocumentVaultView';
import {
  MobileTab,
  DocumentSubmission,
  ListingEnquiry,
  MarketplaceListing,
  HealthStatusResponse,
} from '../types';
import { UserProfile } from '@greenart/shared-types';

export interface ClientPortalScreenProps {
  bottomInset: number;
  profileViewMode: 'overview' | 'vault' | 'enquiries';
  setProfileViewMode: (m: 'overview' | 'vault' | 'enquiries') => void;
  vaultDocuments: DocumentSubmission[];
  handleUploadDocument: (doc: DocumentSubmission) => void;
  submittedEnquiries: ListingEnquiry[];
  userSubmittedListings: MarketplaceListing[];
  backendHealth: HealthStatusResponse | null;
  setActiveTab: (tab: MobileTab) => void;
  setPreviousTab: (tab: MobileTab) => void;
  currentUser?: UserProfile | null;
  isAuthenticated?: boolean;
  onLoginWithGoogle?: () => void;
  onLogout?: () => void;
  isLoggingIn?: boolean;
  authError?: string | null;
}

export const ClientPortalScreen: React.FC<ClientPortalScreenProps> = ({
  bottomInset,
  profileViewMode,
  setProfileViewMode,
  vaultDocuments,
  handleUploadDocument,
  submittedEnquiries,
  userSubmittedListings,
  backendHealth,
  setActiveTab,
  setPreviousTab,
  currentUser = null,
  isAuthenticated = false,
  onLoginWithGoogle,
  onLogout,
  isLoggingIn = false,
  authError = null,
}) => {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 110 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      <View style={styles.screenHeaderBox}>
        <Text style={styles.viewTitle}>Client Portal & Vault</Text>
        <Text style={styles.viewSubtitle}>
          Institutional property valuation intelligence, title documents, and seller management.
        </Text>
      </View>

      {/* Profile Sub-navigation Pills */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <TouchableOpacity
          style={[
            styles.historyModePill,
            profileViewMode === 'overview' && styles.historyModePillActive,
          ]}
          onPress={() => setProfileViewMode('overview')}
        >
          <Text
            style={[
              styles.historyModePillText,
              profileViewMode === 'overview' && styles.historyModePillTextActive,
            ]}
          >
            Account Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.historyModePill,
            profileViewMode === 'vault' && styles.historyModePillActive,
          ]}
          onPress={() => setProfileViewMode('vault')}
        >
          <Text
            style={[
              styles.historyModePillText,
              profileViewMode === 'vault' && styles.historyModePillTextActive,
            ]}
          >
            Document Vault ({vaultDocuments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.historyModePill,
            profileViewMode === 'enquiries' && styles.historyModePillActive,
          ]}
          onPress={() => setProfileViewMode('enquiries')}
        >
          <Text
            style={[
              styles.historyModePillText,
              profileViewMode === 'enquiries' && styles.historyModePillTextActive,
            ]}
          >
            Enquiries ({submittedEnquiries.length})
          </Text>
        </TouchableOpacity>
      </View>

      {profileViewMode === 'vault' ? (
        <DocumentVaultView
          documents={vaultDocuments}
          onUploadDocument={handleUploadDocument}
        />
      ) : profileViewMode === 'enquiries' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Direct Land Enquiries</Text>
          <Text style={styles.cardSubtitle}>
            Verified enquiries routed directly to plot owners:
          </Text>
          {submittedEnquiries.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#64748B' }}>
                No plot enquiries submitted yet.
              </Text>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { marginTop: 12 }]}
                onPress={() => setActiveTab('marketplace')}
              >
                <Text style={styles.primaryActionBtnText}>Explore Buy Marketplace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {submittedEnquiries.map((enq) => (
                <View
                  key={enq.id}
                  style={{
                    backgroundColor: '#F8FAFC',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                    {enq.listingTitle}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Enquiry ID: {enq.id} • Sent {new Date(enq.submittedAt).toLocaleDateString()}
                  </Text>
                  {enq.offeredPriceTotal && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#240046', marginTop: 4 }}>
                      Offer Consideration: ₹{enq.offeredPriceTotal.toLocaleString('en-IN')}
                    </Text>
                  )}
                  <Text style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                    "{enq.message}"
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
          {/* Profile & Google Auth Card */}
          {isAuthenticated && currentUser ? (
            <View style={styles.card}>
              <View style={styles.profileHeroRow}>
                <View style={[styles.profileHeroAvatar, { backgroundColor: '#240046', borderWidth: 2, borderColor: '#D4AF37' }]}>
                  <Text style={styles.profileHeroAvatarText}>
                    {currentUser.fullName
                      ? currentUser.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                      : 'GA'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileOrgName}>{currentUser.fullName}</Text>
                  <Text style={styles.profileRoleTitle}>{currentUser.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        backgroundColor: '#FEFCE8',
                        borderWidth: 1,
                        borderColor: '#FDE68A',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
                        {currentUser.role}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: currentUser.isSellerVerified ? '#ECFDF5' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: currentUser.isSellerVerified ? '#A7F3D0' : '#CBD5E1',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: currentUser.isSellerVerified ? '#047857' : '#475569' }}>
                        {currentUser.isSellerVerified ? '✓ Verified Seller' : 'Standard Buyer'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Sign Out Button */}
              <TouchableOpacity
                style={{
                  marginTop: 14,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#F8FAFC',
                  alignItems: 'center',
                }}
                onPress={onLogout}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>
                  Sign Out of Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { borderColor: '#E9D5FF', backgroundColor: '#FFFFFF' }]}>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#240046' }}>
                  Sign In to Client Portal
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 17 }}>
                  Sign in with your Google account to unlock institutional property vault access, manage listings, and submit direct enquiries.
                </Text>
              </View>

              {authError && (
                <View style={{ marginBottom: 12, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' }}>
                  <Text style={{ fontSize: 11, color: '#991B1B' }}>
                    {authError}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { flexDirection: 'row', gap: 8, justifyContent: 'center' },
                ]}
                onPress={onLoginWithGoogle}
                disabled={isLoggingIn}
                activeOpacity={0.85}
              >
                {isLoggingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#240046' }}>G</Text>
                  </View>
                )}
                <Text style={styles.primaryActionBtnText}>
                  {isLoggingIn ? 'Verifying with Google...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#FAF5FF',
                  borderWidth: 1.2,
                  borderColor: '#D4AF37',
                  alignItems: 'center',
                }}
                onPress={onLogout}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#240046' }}>
                  🔑 Sign In with Password or Register via OTP →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Seller Workspace Shortcut */}
          <TouchableOpacity
            style={[styles.card, { borderColor: '#D4AF37', backgroundColor: '#FAF5FF' }]}
            onPress={() => setActiveTab('sell')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#240046' }}>
              Land Owner & Seller Workspace →
            </Text>
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              Manage {userSubmittedListings.length} plot listings, track legal review status, or post a new plot.
            </Text>
          </TouchableOpacity>

          {/* System & PostGIS Diagnostics Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>System Diagnostics</Text>
            <Text style={styles.cardSubtitle}>
              PostgreSQL/PostGIS spatial architecture verification:
            </Text>

            <View style={styles.diagItemRow}>
              <Text style={styles.diagItemKey}>Backend Engine</Text>
              <Text style={styles.diagItemVal}>ASP.NET Core 8.0</Text>
            </View>
            <View style={styles.diagItemRow}>
              <Text style={styles.diagItemKey}>Database Engine</Text>
              <Text style={styles.diagItemVal}>PostgreSQL 16</Text>
            </View>
            <View style={styles.diagItemRow}>
              <Text style={styles.diagItemKey}>Spatial Extension</Text>
              <Text style={styles.diagItemVal}>
                {backendHealth?.database?.postgisVersion || 'PostGIS 3.4'}
              </Text>
            </View>
            <View style={styles.diagItemRow}>
              <Text style={styles.diagItemKey}>Spatial Indexing</Text>
              <Text style={styles.diagItemVal}>GIST (SRID 4326)</Text>
            </View>
            <View style={styles.diagItemRow}>
              <Text style={styles.diagItemKey}>API Health</Text>
              <Text
                style={[
                  styles.diagItemVal,
                  { color: backendHealth?.status === 'Healthy' ? '#16A34A' : '#D97706' },
                ]}
              >
                {backendHealth?.status === 'Healthy' ? 'Online (Port 5039)' : 'Reconnecting'}
              </Text>
            </View>
          </View>

          {/* Statutory Framework */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statutory Benchmark Compliance</Text>
            <Text style={styles.cardSubtitle}>
              Tamil Nadu Registration Department (TNREGINET)
            </Text>
            <Text style={styles.profileNoticeText}>
              All market rates are derived strictly from open-market verified transactions.
              Government guideline rates are maintained purely as statutory reference points for
              stamp duty benchmarks.
            </Text>

            <TouchableOpacity
              style={[styles.secondaryActionBtn, { marginTop: 12 }]}
              onPress={() => {
                setPreviousTab('profile');
                setActiveTab('guideline');
              }}
            >
              <Text style={styles.secondaryActionBtnText}>Read Full Methodology</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  screenHeaderBox: {
    marginBottom: 4,
  },
  viewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  historyModePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  historyModePillActive: {
    backgroundColor: '#240046',
    borderColor: '#D4AF37',
  },
  historyModePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  historyModePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileHeroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileOrgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileRoleTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  diagItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF5FF',
  },
  diagItemKey: {
    fontSize: 12,
    color: '#64748B',
  },
  diagItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileNoticeText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  primaryActionBtn: {
    backgroundColor: '#240046',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryActionBtnText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

