export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role: 'Customer' | 'Reviewer' | 'Administrator';
  accountStatus: 'Active' | 'Suspended' | 'Deactivated';
  isSellerVerified: boolean;
  sellerType: 'IndividualOwner' | 'Promoter' | 'LicensedAgent';
  createdAtUtc: string;
  lastLoginAtUtc?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: UserProfile;
}

export interface RequestOtpRequest {
  email: string;
  fullName: string;
  phoneNumber?: string;
}

export interface RequestOtpResponse {
  message: string;
  email: string;
  devOtpHint?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  tempVerificationToken: string;
}

export interface CompleteRegistrationRequest {
  email: string;
  password: string;
  tempVerificationToken: string;
  fullName?: string;
  phoneNumber?: string;
}

export interface PasswordLoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role: 'Customer' | 'Reviewer' | 'Administrator';
  accountStatus: 'Active' | 'Suspended' | 'Deactivated';
  isEmailVerified: boolean;
  isSellerVerified: boolean;
  sellerType: 'IndividualOwner' | 'Promoter' | 'LicensedAgent';
  createdAtUtc: string;
  lastLoginAtUtc?: string;
  hasPassword: boolean;
  hasGoogleAuth: boolean;
}

