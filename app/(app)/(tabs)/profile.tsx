import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { getMyKycDetails, type CustomerKycDetails } from '@/services/kyc';

const formatAccountStatus = (status?: string | null) => {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split(/[_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

export default function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn, isHydrating, user, isFetchingProfile, refreshProfile, signOut, ensureSession } = useAuth();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [kycDetails, setKycDetails] = useState<CustomerKycDetails | null>(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);

  useEffect(() => {
    if (user && profileError) {
      setProfileError(null);
    }
  }, [user, profileError]);

  const loadKycDetails = useCallback(async () => {
    if (!user) {
      setKycDetails(null);
      setKycError(null);
      return null;
    }

    setIsLoadingKyc(true);
    setKycError(null);

    try {
      const session = await ensureSession();

      if (!session?.accessToken) {
        throw new Error('Please sign in again to view your KYC details.');
      }

      const details = await getMyKycDetails({
        accessToken: session.accessToken,
        tokenType: session.tokenType,
      });

      setKycDetails(details);

      return details;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load KYC information. Please try again later.';
      setKycError(message);
      return null;
    } finally {
      setIsLoadingKyc(false);
    }
  }, [ensureSession, user]);

  useEffect(() => {
    void loadKycDetails();
  }, [loadKycDetails]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  }, [router, signOut]);

  const handleRefreshProfile = useCallback(async () => {
    if (isFetchingProfile) {
      return;
    }

    setProfileError(null);
    setKycError(null);

    try {
      await refreshProfile();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to refresh your profile. Please try again.';
      setProfileError(message);
    }
    await loadKycDetails();
  }, [isFetchingProfile, refreshProfile, loadKycDetails]);

  const contactItems = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        id: 'customerId',
        label: 'Customer ID',
        value: `#${user.customerId}`,
        icon: 'pricetag-outline' as const,
      },
      {
        id: 'username',
        label: 'Username',
        value: user.username,
        icon: 'person-outline' as const,
      },
      {
        id: 'email',
        label: 'Email',
        value: user.email ?? 'Not provided',
        icon: 'mail-outline' as const,
      },
      {
        id: 'phone',
        label: 'Phone Number',
        value:
          user.phoneNumber && user.phoneNumber.trim().length > 0
            ? user.phoneNumber
            : 'Not provided',
        icon: 'call-outline' as const,
      },
      {
        id: 'status',
        label: 'Account Status',
        value: formatAccountStatus(user.status),
        icon: 'shield-checkmark-outline' as const,
      },
    ];
  }, [user]);

  const normalizedKycStatus = (kycDetails?.kycStatus ?? user?.kycStatus ?? 'NOT_STARTED').toUpperCase();

  const kycStatusMeta = useMemo(() => {
    const friendlyStatus = formatAccountStatus(normalizedKycStatus);

    if (normalizedKycStatus === 'VERIFIED') {
      const verifiedAt = formatDateTime(kycDetails?.verifiedAt);

      return {
        friendlyStatus,
        badgeStyle: styles.kycStatusBadgeSuccess,
        badgeTextStyle: styles.kycStatusBadgeTextSuccess,
        description: verifiedAt
          ? `Your identity was verified on ${verifiedAt}.`
          : 'Your identity has been verified. You are ready to rent devices.',
        actionLabel: null,
        actionType: null,
      } as const;
    }

    if (normalizedKycStatus === 'DOCUMENTS_SUBMITTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.kycStatusBadgeWarning,
        badgeTextStyle: styles.kycStatusBadgeTextWarning,
        description: 'Thank you! Your documents were submitted and are awaiting review.',
        actionLabel: 'Refresh Status',
        actionType: 'refresh' as const,
      } as const;
    }

    if (normalizedKycStatus === 'NOT_STARTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.kycStatusBadgeDanger,
        badgeTextStyle: styles.kycStatusBadgeTextDanger,
        description: 'Complete identity verification to unlock faster approvals and rentals.',
        actionLabel: 'Start KYC Process',
        actionType: 'start' as const,
      } as const;
    }

    return {
      friendlyStatus,
      badgeStyle: styles.kycStatusBadgeNeutral,
      badgeTextStyle: styles.kycStatusBadgeTextNeutral,
      description: 'Keep your documents up to date to avoid delays with future rentals.',
      actionLabel: 'Refresh Status',
      actionType: 'refresh' as const,
    } as const;
  }, [kycDetails?.verifiedAt, normalizedKycStatus]);

  const handleKycAction = useCallback(() => {
    if (kycStatusMeta.actionType === 'start') {
      router.push('/(app)/kyc-documents');
      return;
    }

    if (kycStatusMeta.actionType === 'refresh') {
      void loadKycDetails();
    }
  }, [kycStatusMeta.actionType, loadKycDetails, router]);

  const isAccountActive = user?.status?.toUpperCase() === 'ACTIVE';

  const isInitialLoading = isHydrating || (!user && isFetchingProfile);

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#111111" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.unauthContainer}>
          <Ionicons name="person-circle-outline" size={72} color="#111111" />
          <Text style={styles.unauthTitle}>Sign in to view your profile</Text>
          <Text style={styles.unauthSubtitle}>
            Access your orders, manage rentals, and update account information after signing in.
          </Text>
          <TouchableOpacity
            style={[styles.authButton, styles.authPrimaryButton]}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={[styles.authButtonText, styles.authPrimaryButtonText]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.authSecondaryButton]}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text style={[styles.authButtonText, styles.authSecondaryButtonText]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.profileErrorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#111111" />
          <Text style={styles.profileErrorTitle}>Unable to load your profile</Text>
          <Text style={styles.profileErrorSubtitle}>
            {profileError ?? 'We couldn’t fetch your account details. Please try again.'}
          </Text>
          <TouchableOpacity
            style={[styles.authButton, styles.authPrimaryButton]}
            onPress={() => void handleRefreshProfile()}
            disabled={isFetchingProfile}
          >
            <Text style={[styles.authButtonText, styles.authPrimaryButtonText]}>
              {isFetchingProfile ? 'Refreshing…' : 'Try Again'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.authSecondaryButton]}
            onPress={() => void handleLogout()}
            disabled={isFetchingProfile}
          >
            <Text style={[styles.authButtonText, styles.authSecondaryButtonText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(isFetchingProfile)}
            onRefresh={() => void handleRefreshProfile()}
            tintColor="#111111"
            colors={["#111111"]}
          />
        }
      >
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={32} color="#111" />
          <Text style={styles.headerTitle}>User Profile</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                isFetchingProfile && styles.headerActionButtonDisabled,
              ]}
              onPress={() => void handleRefreshProfile()}
              disabled={isFetchingProfile}
            >
              {isFetchingProfile ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <Ionicons name="refresh-outline" size={22} color="#111" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {profileError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#7f1d1d" />
            <Text style={styles.errorBannerText}>{profileError}</Text>
          </View>
        )}

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>
            {user.fullName && user.fullName.trim().length > 0 ? user.fullName : user.username}
          </Text>
          <Text style={styles.profileUsername}>@{user.username}</Text>
          <Text style={styles.profileEmail}>{user.email ?? 'Email unavailable'}</Text>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Customer #{user.customerId}</Text>
          </View>
        </View>

        <View style={styles.selfieCard}>
          <MaterialCommunityIcons
            name={isAccountActive ? 'shield-check' : 'shield-alert'}
            size={28}
            color={isAccountActive ? '#16a34a' : '#dc2626'}
          />
          <Text style={styles.selfieTitle}>Account Status</Text>
          <Text style={styles.selfieSubtitle}>
            {isAccountActive
              ? 'Your account is active and ready for rentals.'
              : 'Your account is currently inactive. Please contact support for assistance.'}
          </Text>
          <Text style={styles.selfieStatus}>{formatAccountStatus(user.status)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.contactList}>
            {contactItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.contactItem,
                  index === contactItems.length - 1 && styles.contactItemLast,
                ]}
              >
                <View style={styles.contactIconWrapper}>
                  <Ionicons name={item.icon} size={22} color="#111" />
                </View>
                <View style={styles.contactDetails}>
                  <Text style={styles.contactLabel}>{item.label}</Text>
                  <Text style={styles.contactValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.kycCard}>
          <View style={styles.kycHeader}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#111111" />
            <Text style={styles.kycTitle}>Identity Verification</Text>
            {isLoadingKyc ? <ActivityIndicator size="small" color="#111111" /> : null}
          </View>
          <View style={[styles.kycStatusBadge, kycStatusMeta.badgeStyle]}>
            <Text style={[styles.kycStatusBadgeText, kycStatusMeta.badgeTextStyle]}>{kycStatusMeta.friendlyStatus}</Text>
          </View>
          <Text style={styles.kycDescription}>{kycStatusMeta.description}</Text>
          {kycError ? <Text style={styles.kycErrorText}>{kycError}</Text> : null}
          {kycDetails ? (
            <TouchableOpacity
              style={styles.kycLinkButton}
              onPress={() => router.push('/(app)/kyc-status')}
              activeOpacity={0.85}
            >
              <View style={styles.kycLinkButtonContent}>
                <View style={styles.kycLinkIconWrapper}>
                  <Ionicons name="images-outline" size={18} color="#111111" />
                </View>
                <View style={styles.kycLinkCopy}>
                  <Text style={styles.kycLinkTitle}>Show my KYC documents</Text>
                  <Text style={styles.kycLinkSubtitle}>
                    View the photos and details you previously submitted for verification.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ) : !kycError && !isLoadingKyc ? (
            <Text style={styles.kycPlaceholderText}>
              {normalizedKycStatus === 'NOT_STARTED'
                ? 'You have not started the KYC process yet.'
                : 'We could not find any KYC documents for your account.'}
            </Text>
          ) : null}
          {kycStatusMeta.actionLabel ? (
            <TouchableOpacity
              style={[
                styles.kycActionButton,
                kycStatusMeta.actionType === 'start' ? styles.kycActionButtonPrimary : styles.kycActionButtonSecondary,
                isLoadingKyc && styles.kycActionButtonDisabled,
              ]}
              onPress={handleKycAction}
              disabled={isLoadingKyc}
            >
              <Text
                style={[
                  styles.kycActionButtonText,
                  kycStatusMeta.actionType === 'start'
                    ? styles.kycActionButtonTextPrimary
                    : styles.kycActionButtonTextSecondary,
                ]}
              >
                {kycStatusMeta.actionLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => void handleLogout()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  unauthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  unauthTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  unauthSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
  authButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  authPrimaryButton: {
    backgroundColor: '#111111',
  },
  authPrimaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  authSecondaryButton: {
    borderWidth: 1,
    borderColor: '#111111',
  },
  authSecondaryButtonText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 16,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginHorizontal: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonDisabled: {
    opacity: 0.6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  profileCard: {
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    padding: 20,
    gap: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  profileUsername: {
    fontSize: 14,
    color: '#6b7280',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
  },
  profileBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  selfieCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  selfieTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  selfieSubtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 6,
  },
  selfieStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    textTransform: 'uppercase',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  contactList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececec',
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  contactItemLast: {
    borderBottomWidth: 0,
  },
  contactIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  kycCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 16,
  },
  kycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
  },
  kycDescription: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  kycErrorText: {
    fontSize: 13,
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: '600',
  },
  kycStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  kycStatusBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  kycStatusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  kycStatusBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  kycStatusBadgeNeutral: {
    backgroundColor: '#e5e7eb',
  },
  kycStatusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kycStatusBadgeTextSuccess: {
    color: '#166534',
  },
  kycStatusBadgeTextWarning: {
    color: '#92400e',
  },
  kycStatusBadgeTextDanger: {
    color: '#b91c1c',
  },
  kycStatusBadgeTextNeutral: {
    color: '#1f2937',
  },
  kycPlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
  },
  kycLinkButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  kycLinkButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycLinkIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycLinkCopy: {
    flex: 1,
    gap: 2,
  },
  kycLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  kycLinkSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  kycActionButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
  },
  kycActionButtonPrimary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  kycActionButtonSecondary: {
    backgroundColor: '#ffffff',
    borderColor: '#111111',
  },
  kycActionButtonDisabled: {
    opacity: 0.6,
  },
  kycActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  kycActionButtonTextPrimary: {
    color: '#ffffff',
  },
  kycActionButtonTextSecondary: {
    color: '#111111',
  },
  logoutButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111111',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  profileErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  profileErrorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  profileErrorSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
});
