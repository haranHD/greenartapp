import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { PremiumPressable } from '../components/PremiumPressable';
import { useReducedMotion } from '../hooks/useReducedMotion';
import Feather from '@expo/vector-icons/Feather';
import { Premium as P } from '../theme/premium';
import { ScreenUI, withScreenStyles } from '../theme/screenUI';
import { ScreenEntrance } from '../components/ScreenEntrance';
import { PremiumChoice } from '../components/PremiumChoice';
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
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
import { authService } from '../services/auth';

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
  // Profile Editing State
  const { reduced } = useReducedMotion();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editPhoneNumber, setEditPhoneNumber] = useState(currentUser?.phoneNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  const handleStartEdit = () => {
    setEditFullName(currentUser?.fullName || '');
    setEditPhoneNumber(currentUser?.phoneNumber || '');
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      setProfileErrorMsg('Full name cannot be blank.');
      return;
    }

    setIsSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    try {
      await authService.updateProfile(editFullName.trim(), editPhoneNumber.trim() || undefined);
      setProfileSuccessMsg('Profile details successfully updated on the server.');
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to update profile. Please retry.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccessMsg('Your account password has been updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Failed to change password. Check current credentials.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const formattedJoinDate = currentUser?.createdAtUtc
    ? new Date(currentUser.createdAtUtc).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
    })
    : 'Not available';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.background }}
      contentContainerStyle={[styles.scrollBody, { paddingBottom: 24 + bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      <ScreenEntrance>
      <View style={styles.screenHeaderBox}>
        <Text style={styles.viewTitle}>Account & Settings</Text>
      </View>

      <View style={styles.accountSegments}>
        <PremiumChoice variant="segment" label="Account Details" selected={profileViewMode === 'overview'} onPress={() => setProfileViewMode('overview')} />
        <PremiumChoice variant="segment" label={`Title Vault (${vaultDocuments.length})`} selected={profileViewMode === 'vault'} onPress={() => setProfileViewMode('vault')} />
        <PremiumChoice variant="segment" label={`My Enquiries (${submittedEnquiries.length})`} selected={profileViewMode === 'enquiries'} onPress={() => setProfileViewMode('enquiries')} />
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
            Your enquiries sent directly to property owners:
          </Text>
          {submittedEnquiries.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#64748B' }}>
                No plot enquiries submitted yet.
              </Text>
              <PremiumPressable reducedMotion={reduced}
                style={[styles.primaryActionBtn, { marginTop: 14 }]}
                onPress={() => setActiveTab('marketplace')}
              >
                <Text style={styles.primaryActionBtnText}>Browse Available Plots</Text>
              </PremiumPressable>
            </View>
          ) : (
            <View style={{ gap: 12, marginTop: 10 }}>
              {submittedEnquiries.map((enq) => (
                <View
                  key={enq.id}
                  style={{
                    backgroundColor: '#FAF8FC',
                    padding: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#E9D5FF',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 }}>
                      {enq.listingTitle}
                    </Text>
                    <View style={{ backgroundColor: '#FEFCE8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#FDE68A' }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#92400E' }}>Active</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Sent {new Date(enq.submittedAt).toLocaleDateString()}
                  </Text>
                  {enq.offeredPriceTotal && (
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#240046', marginTop: 6 }}>
                      Offer Consideration: ₹{enq.offeredPriceTotal.toLocaleString('en-IN')}
                    </Text>
                  )}
                  <Text style={{ fontSize: 12, color: '#334155', marginTop: 6, lineHeight: 18 }}>
                    "{enq.message}"
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
          {/* Authenticated User Hero Card */}
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileOrgName}>{currentUser.fullName}</Text>
                  <Text style={styles.profileRoleTitle}>{currentUser.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>Signed in</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Success / Error Feedback */}
              {profileSuccessMsg && (
                <View style={[styles.alertBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={{ color: '#065F46', fontSize: 12, fontWeight: '600' }}>✓ {profileSuccessMsg}</Text>
                </View>
              )}
              {profileErrorMsg && (
                <View style={[styles.alertBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#991B1B', fontSize: 12, fontWeight: '600' }}> {profileErrorMsg}</Text>
                </View>
              )}
              {passwordSuccessMsg && (
                <View style={[styles.alertBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={{ color: '#065F46', fontSize: 12, fontWeight: '600' }}>✓ {passwordSuccessMsg}</Text>
                </View>
              )}
              {passwordErrorMsg && (
                <View style={[styles.alertBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#991B1B', fontSize: 12, fontWeight: '600' }}> {passwordErrorMsg}</Text>
                </View>
              )}

              {/* Editable Profile Section */}
              {isEditingProfile ? (
                <View style={styles.editSection}>
                  <Text style={styles.sectionHeader}>Edit Personal Information</Text>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      accessibilityLabel="Account full name"
                      value={editFullName}
                      onChangeText={setEditFullName}
                      placeholder="Your full legal name"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.textInput}
                      accessibilityLabel="Account phone number"
                      value={editPhoneNumber}
                      onChangeText={setEditPhoneNumber}
                      placeholder="e.g. +91 98765 43210"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.primaryActionBtn, { flex: 1 }]}
                      onPress={handleSaveProfile}
                      accessibilityState={{ disabled: isSavingProfile, busy: isSavingProfile }}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Save Changes</Text>
                      )}
                    </PremiumPressable>

                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.secondaryActionBtn, { flex: 1 }]}
                      onPress={() => setIsEditingProfile(false)}
                      disabled={isSavingProfile}
                    >
                      <Text style={styles.secondaryActionBtnText}>Cancel</Text>
                    </PremiumPressable>
                  </View>
                </View>
              ) : isChangingPassword ? (
                <View style={styles.editSection}>
                  <Text style={styles.sectionHeader}>Change Account Password</Text>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.inputLabel}>Current Password (if set)</Text>
                    <TextInput
                      style={styles.textInput}
                      accessibilityLabel="Current password"
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.inputLabel}>New Password (min 6 characters)</Text>
                    <TextInput
                      style={styles.textInput}
                      accessibilityLabel="New password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                    <TextInput
                      style={styles.textInput}
                      accessibilityLabel="Confirm new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.primaryActionBtn, { flex: 1 }]}
                      onPress={handleChangePassword}
                      accessibilityState={{ disabled: isSavingPassword, busy: isSavingPassword }}
                      disabled={isSavingPassword}
                    >
                      {isSavingPassword ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Update Password</Text>
                      )}
                    </PremiumPressable>

                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.secondaryActionBtn, { flex: 1 }]}
                      onPress={() => setIsChangingPassword(false)}
                      disabled={isSavingPassword}
                    >
                      <Text style={styles.secondaryActionBtnText}>Cancel</Text>
                    </PremiumPressable>
                  </View>
                </View>
              ) : (
                <View style={styles.detailsList}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Phone Number</Text>
                    <Text style={styles.detailVal}>{currentUser.phoneNumber || 'Not provided'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Account Status</Text>
                    <Text style={[styles.detailVal, { color: '#16A34A' }]}>{currentUser.accountStatus}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Member Since</Text>
                    <Text style={styles.detailVal}>{formattedJoinDate}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.secondaryActionBtn, { flex: 1 }]}
                      onPress={handleStartEdit}
                    >
                      <Feather accessible={false} name="edit-3" size={16} color={P.purple} /><Text style={styles.secondaryActionBtnText}>Edit Profile</Text>
                    </PremiumPressable>

                    <PremiumPressable reducedMotion={reduced}
                      style={[styles.secondaryActionBtn, { flex: 1 }]}
                      onPress={() => {
                        setPasswordErrorMsg(null);
                        setPasswordSuccessMsg(null);
                        setIsChangingPassword(true);
                      }}
                    >
                      <Feather accessible={false} name="lock" size={16} color={P.purple} /><Text style={styles.secondaryActionBtnText}>Change Password</Text>
                    </PremiumPressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Quick Services & Tools */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.navRowItem}
              onPress={() => setActiveTab('sell')}
              activeOpacity={0.75}
            >
              <Feather accessible={false} name="briefcase" size={21} color={P.purple} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navRowTitle}>Land Owner & Seller Workspace</Text>
                <Text style={styles.navRowSub}>Manage plot listings, title documents, or list a property</Text>
              </View>
              <Feather accessible={false} name="chevron-right" size={19} color={P.secondary} />
            </TouchableOpacity>

            <View style={styles.navRowDivider} />

            <TouchableOpacity
              style={styles.navRowItem}
              onPress={() => {
                setPreviousTab('profile');
                setActiveTab('guideline');
              }}
              activeOpacity={0.75}
            >
              <Feather accessible={false} name="book-open" size={21} color={P.purple} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navRowTitle}>Methodology & Statutory Benchmarks</Text>
                <Text style={styles.navRowSub}>TNREGINET guideline rate principles and 1km spatial engine</Text>
              </View>
              <Feather accessible={false} name="chevron-right" size={19} color={P.secondary} />
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          {isAuthenticated && (
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: '#FFFFFF', borderColor: '#FCA5A5', marginTop: 4, marginBottom: 20 },
              ]}
              onPress={onLogout}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
      </ScreenEntrance>
    </ScrollView>
  );
};

const styles = withScreenStyles({
  accountSegments: { ...ScreenUI.segments },
  scrollBody: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: 20,
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
    borderRadius: 8,
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
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  navRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  navRowTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  navRowSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  navRowChevron: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '800',
    marginLeft: 10,
  },
  navRowDivider: {
    height: 1,
    backgroundColor: '#FAF5FF',
    marginVertical: 4,
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
  rolePill: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  detailsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailKey: {
    fontSize: 12,
    color: '#64748B',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  editSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FAF5FF',
    paddingTop: 12,
    gap: 10,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#240046',
    marginBottom: 4,
  },
  fieldWrap: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  textInput: {
    backgroundColor: '#FAF8FC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  alertBanner: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 10,
  },
  profileNoticeText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  primaryActionBtn: {
    backgroundColor: '#240046',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  secondaryActionBtnText: {
    color: '#240046',
    fontSize: 14.5,
    fontWeight: '600',
  },
}, {
  scrollBody: { ...ScreenUI.content }, screenHeaderBox: { marginBottom: 0 }, viewTitle: ScreenUI.heading,
  card: ScreenUI.card, cardTitle: { color: P.text, fontSize: 18, lineHeight: 25 }, cardSubtitle: ScreenUI.subtitle,
  profileHeroRow: { gap: 14, alignItems: 'center' }, profileHeroAvatar: { backgroundColor: P.violet, width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: P.gold }, profileOrgName: { color: P.text, fontSize: 19, lineHeight: 27 }, profileRoleTitle: { ...ScreenUI.subtitle, fontSize: 13 },
  detailsList: { borderTopColor: P.border, marginTop: 20, paddingTop: 12 }, detailRow: { flexWrap: 'wrap', gap: 8, paddingVertical: 10 }, detailKey: { color: P.secondary, fontSize: 13 }, detailVal: { color: P.text, fontSize: 13, flexShrink: 1 },
  textInput: ScreenUI.input, inputLabel: { ...ScreenUI.section, fontSize: 12 }, editSection: { borderTopColor: P.border, marginTop: 18, paddingTop: 18, gap: 14 }, sectionHeader: { fontSize: 16, lineHeight: 24, color: P.violet },
  primaryActionBtn: ScreenUI.primary, primaryActionBtnText: ScreenUI.primaryText, secondaryActionBtn: ScreenUI.secondary, secondaryActionBtnText: ScreenUI.secondaryText,
  navRowItem: { minHeight: 76, paddingVertical: 14, gap: 13 }, navRowTitle: { color: P.text, fontSize: 14, lineHeight: 21 }, navRowSub: { color: P.secondary, fontSize: 12, lineHeight: 19, marginTop: 4 }, navRowDivider: { backgroundColor: P.border },
  statusPill: { backgroundColor: P.lavender, borderColor: P.border, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }, statusPillText: { color: P.purple, fontSize: 10, fontWeight: '600' }, alertBanner: { padding: 13, borderRadius: 12 },
});
