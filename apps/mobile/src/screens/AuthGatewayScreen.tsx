import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Colors } from '../theme/colors';
import { authService } from '../services/auth';

interface AuthGatewayScreenProps {
  onSuccess: () => void;
}

type AuthMode = 'login' | 'register';
type RegisterStep = 'details' | 'otp' | 'password';

export const AuthGatewayScreen: React.FC<AuthGatewayScreenProps> = ({
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // Sign In State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [tempVerificationToken, setTempVerificationToken] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handlePasswordLogin = async () => {
    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await authService.loginWithPassword(loginIdentifier.trim(), loginPassword);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const googleIdToken = (typeof window !== 'undefined' && (window as any).googleIdToken)
        ? (window as any).googleIdToken
        : 'dev-google-token-sample';
      await authService.loginWithGoogle(googleIdToken);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!regFullName.trim() || !regEmail.trim()) {
      setErrorMessage('Full name and email address are required.');
      return;
    }

    if (!regEmail.includes('@') || !regEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await authService.requestOtp(regEmail.trim(), regFullName.trim(), regPhone.trim() || undefined);
      if (res.devOtpHint) {
        setDevOtpHint(res.devOtpHint);
      }
      setSuccessMessage('A 6-digit verification code has been dispatched to your email.');
      setRegisterStep('otp');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send verification code. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const token = await authService.verifyOtp(regEmail.trim(), otpCode.trim());
      setTempVerificationToken(token);
      setSuccessMessage('Email verified successfully! Now configure your password.');
      setRegisterStep('password');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await authService.completeRegistration(
        regEmail.trim(),
        regPassword,
        tempVerificationToken,
        regFullName.trim(),
        regPhone.trim() || undefined
      );
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Brand Hero Header */}
      <View style={styles.heroSection}>
        <View style={styles.logoBadgeContainer}>
          <View style={styles.brandLogoCircle}>
            <Text style={styles.brandLogoInitial}>G</Text>
          </View>
        </View>
        <Text style={styles.brandTitle}>GREENART PROPERTIES</Text>
        <View style={styles.taglineBadge}>
          <Text style={styles.taglineText}>LAND MARKET RATE ANALYST</Text>
        </View>
        <Text style={styles.heroSubtitle}>
          Tamil Nadu's premier institutional land price intelligence & verified marketplace platform
        </Text>
      </View>

      {/* Main Authentication Card */}
      <View style={styles.authCard}>
        {/* Mode Switcher Tabs */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, authMode === 'login' && styles.tabButtonActive]}
            onPress={() => {
              setAuthMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, authMode === 'login' && styles.tabButtonTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, authMode === 'register' && styles.tabButtonActive]}
            onPress={() => {
              setAuthMode('register');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, authMode === 'register' && styles.tabButtonTextActive]}>
              Register / First Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Global Error Banner */}
        {errorMessage && (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>⚠️ {errorMessage}</Text>
          </View>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <View style={styles.alertSuccess}>
            <Text style={styles.alertSuccessText}>✓ {successMessage}</Text>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: RETURNING USER SIGN IN                                */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'login' && (
          <View style={styles.formContainer}>
            <Text style={styles.formHeaderTitle}>Welcome Back</Text>
            <Text style={styles.formHeaderSubtitle}>
              Sign in with your registered email/username or Google account
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email or Username</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. analyst@greenart.com"
                placeholderTextColor="#94A3B8"
                value={loginIdentifier}
                onChangeText={setLoginIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => setShowLoginPassword(!showLoginPassword)}>
                  <Text style={styles.showPasswordText}>
                    {showLoginPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Enter account password"
                placeholderTextColor="#94A3B8"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showLoginPassword}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handlePasswordLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In to Greenart</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google OAuth Alternative */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <View style={styles.googleIconBox}>
                <Text style={styles.googleIconLetter}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.switchHintWrap}>
              <Text style={styles.switchHintText}>First time using the app? </Text>
              <TouchableOpacity onPress={() => setAuthMode('register')}>
                <Text style={styles.switchHintLink}>Verify via OTP →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: NEW USER REGISTRATION WITH OTP VERIFICATION           */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'register' && (
          <View style={styles.formContainer}>
            {/* Step Breadcrumb Indicators */}
            <View style={styles.stepBar}>
              <View style={[styles.stepDot, registerStep === 'details' && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, registerStep === 'details' && styles.stepDotTextActive]}>1</Text>
              </View>
              <View style={[styles.stepLine, registerStep !== 'details' && styles.stepLineActive]} />
              <View style={[styles.stepDot, registerStep === 'otp' && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, registerStep === 'otp' && styles.stepDotTextActive]}>2</Text>
              </View>
              <View style={[styles.stepLine, registerStep === 'password' && styles.stepLineActive]} />
              <View style={[styles.stepDot, registerStep === 'password' && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, registerStep === 'password' && styles.stepDotTextActive]}>3</Text>
              </View>
            </View>

            {/* Step 1: Contact Details & Request OTP */}
            {registerStep === 'details' && (
              <View>
                <Text style={styles.formHeaderTitle}>Create New Account</Text>
                <Text style={styles.formHeaderSubtitle}>
                  Register your account and verify ownership via a 6-digit one-time passcode (OTP).
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Ramesh Kannan"
                    placeholderTextColor="#94A3B8"
                    value={regFullName}
                    onChangeText={setRegFullName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Google / Email Address *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. yourname@gmail.com"
                    placeholderTextColor="#94A3B8"
                    value={regEmail}
                    onChangeText={setRegEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phone Number (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. +91 98765 43210"
                    placeholderTextColor="#94A3B8"
                    value={regPhone}
                    onChangeText={setRegPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleRequestOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Verification Code (OTP) →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Enter & Verify 6-digit OTP */}
            {registerStep === 'otp' && (
              <View>
                <Text style={styles.formHeaderTitle}>Verify Your Email</Text>
                <Text style={styles.formHeaderSubtitle}>
                  Please enter the 6-digit code sent to <Text style={{ fontWeight: '700', color: Colors.primary }}>{regEmail}</Text>
                </Text>

                {devOtpHint && (
                  <TouchableOpacity
                    style={styles.devHintBanner}
                    onPress={() => setOtpCode(devOtpHint)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.devHintTitle}>Development OTP Dispatched:</Text>
                    <Text style={styles.devHintCode}>{devOtpHint} (Tap to autofill)</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>6-Digit Verification Code</Text>
                  <TextInput
                    style={[styles.textInput, styles.otpInput]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#CBD5E1"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify OTP Code →</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.stepBackWrap}>
                  <TouchableOpacity onPress={() => setRegisterStep('details')}>
                    <Text style={styles.stepBackText}>← Change email or full name</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRequestOtp}>
                    <Text style={styles.resendText}>Resend code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Configure Password & Finalize */}
            {registerStep === 'password' && (
              <View>
                <Text style={styles.formHeaderTitle}>Create Account Password</Text>
                <Text style={styles.formHeaderSubtitle}>
                  Configure a secure password for seamless returning logins
                </Text>

                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Create Password *</Text>
                    <TouchableOpacity onPress={() => setShowRegPassword(!showRegPassword)}>
                      <Text style={styles.showPasswordText}>{showRegPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#94A3B8"
                    value={regPassword}
                    onChangeText={setRegPassword}
                    secureTextEntry={!showRegPassword}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Confirm Password *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Re-enter password"
                    placeholderTextColor="#94A3B8"
                    value={regConfirmPassword}
                    onChangeText={setRegConfirmPassword}
                    secureTextEntry={!showRegPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleCompleteRegistration}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Complete Setup & Enter App ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Institutional Compliance Badges */}
      <View style={styles.complianceBox}>
        <Text style={styles.complianceItem}>🔒 Bank-Grade 256-Bit Cryptographic Security</Text>
        <Text style={styles.complianceItem}>🏛️ TNREGINET Statutory Benchmark Integration</Text>
        <Text style={styles.complianceItem}>🛡️ Immutable Audit Logging for All Account Mutations</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8FC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadgeContainer: {
    marginBottom: 10,
  },
  brandLogoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#240046',
    borderWidth: 2.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  brandLogoInitial: {
    fontSize: 28,
    fontWeight: '900',
    color: '#D4AF37',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#240046',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  taglineBadge: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginTop: 6,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#581C87',
    letterSpacing: 0.8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
    lineHeight: 18,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#240046',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#581C87',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  alertError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  alertErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  alertSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  alertSuccessText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  formContainer: {},
  formHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  formHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  showPasswordText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#581C87',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  otpInput: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#240046',
    backgroundColor: '#FAF5FF',
    borderColor: '#D4AF37',
  },
  primaryBtn: {
    backgroundColor: '#240046',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
  },
  googleIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconLetter: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  googleBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchHintWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  switchHintText: {
    fontSize: 12,
    color: '#64748B',
  },
  switchHintLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#581C87',
  },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#240046',
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#D4AF37',
  },
  devHintBanner: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  devHintTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400E',
  },
  devHintCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  stepBackWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  stepBackText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  resendText: {
    fontSize: 11.5,
    color: '#581C87',
    fontWeight: '700',
  },
  complianceBox: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  complianceItem: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

