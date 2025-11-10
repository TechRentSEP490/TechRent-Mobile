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

const VERIFIED_KYC_STATUSES = new Set([
  'VERIFIED',
  'APPROVED',
  'COMPLETED',
]);

const PENDING_KYC_STATUSES = new Set([
  'PENDING',
  'PENDING_VERIFICATION',
  'IN_REVIEW',
  'UNDER_REVIEW',
  'PROCESSING',
  'AWAITING_APPROVAL',
]);

const REJECTED_KYC_STATUSES = new Set(['REJECTED', 'FAILED', 'DECLINED']);

export default function ProfileScreen() {
  const router = useRouter();
  const { isSignedIn, isHydrating, user, isFetchingProfile, refreshProfile, signOut } = useAuth();
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user && profileError) {
      setProfileError(null);
    }
  }, [user, profileError]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  }, [router, signOut]);

  const handleRefreshProfile = useCallback(async () => {
    if (isFetchingProfile) {
      return;
    }

    setProfileError(null);

    try {
      await refreshProfile();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to refresh your profile. Please try again.';
      setProfileError(message);
    }
  }, [isFetchingProfile, refreshProfile]);

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

  const kycReminder = useMemo(() => {
    if (!user) {
      return null;
    }

    const normalizedStatus = (user.kycStatus ?? '').toUpperCase();
    const friendlyStatus =
      normalizedStatus && normalizedStatus.length > 0
        ? formatAccountStatus(normalizedStatus)
        : 'Not Started';

    if (VERIFIED_KYC_STATUSES.has(normalizedStatus)) {
      return {
        icon: 'shield-checkmark' as const,
        iconColor: '#16a34a',
        backgroundColor: '#dcfce7',
        title: 'KYC Verified',
        statusLabel: friendlyStatus,
        description: 'Your identity has been verified. You are ready to create rental orders.',
        actionLabel: undefined,
      };
    }

    if (REJECTED_KYC_STATUSES.has(normalizedStatus)) {
      return {
        icon: 'alert-circle-outline' as const,
        iconColor: '#dc2626',
        backgroundColor: '#fee2e2',
        title: 'KYC Needs Attention',
        statusLabel: friendlyStatus,
        description: 'We could not verify your documents. Please review your information and resubmit.',
        actionLabel: 'Resubmit KYC',
        actionColor: '#dc2626',
        actionTextColor: '#ffffff',
      };
    }

    if (PENDING_KYC_STATUSES.has(normalizedStatus)) {
      return {
        icon: 'time-outline' as const,
        iconColor: '#f97316',
        backgroundColor: '#fff7ed',
        title: 'KYC Under Review',
        statusLabel: friendlyStatus,
        description: 'Thank you! Your documents are under review. We will notify you once verification is complete.',
        actionLabel: 'Refresh Status',
        actionDisabled: true,
        actionColor: '#f1f5f9',
        actionTextColor: '#64748b',
      };
    }

    return {
      icon: 'shield-outline' as const,
      iconColor: '#f59e0b',
      backgroundColor: '#fff7ed',
      title: 'Complete your KYC',
      statusLabel: friendlyStatus,
      description: 'Finish identity verification to unlock all rental features and faster approvals.',
      actionLabel: 'Start KYC',
      actionColor: '#f59e0b',
      actionTextColor: '#111111',
    };
  }, [user]);

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

        {kycReminder && (
          <View style={[styles.kycCard, { backgroundColor: kycReminder.backgroundColor }]}>
            <View style={styles.kycHeader}>
              <Ionicons name={kycReminder.icon} size={24} color={kycReminder.iconColor} />
              <View style={styles.kycTitleGroup}>
                <Text style={styles.kycTitle}>KYC Reminder</Text>
                <Text style={styles.kycStatusLabel}>{kycReminder.statusLabel}</Text>
              </View>
            </View>
            <Text style={styles.kycHeadline}>{kycReminder.title}</Text>
            <Text style={styles.kycDescription}>{kycReminder.description}</Text>
            {kycReminder.actionLabel ? (
              <TouchableOpacity
                style={[
                  styles.kycButton,
                  {
                    backgroundColor: kycReminder.actionColor ?? '#111111',
                  },
                  kycReminder.actionDisabled && styles.kycButtonDisabled,
                ]}
                onPress={() => router.push('/(app)/kyc-documents')}
                disabled={kycReminder.actionDisabled}
              >
                <Text
                  style={[
                    styles.kycButtonText,
                    {
                      color: kycReminder.actionDisabled
                        ? '#6b7280'
                        : kycReminder.actionTextColor ?? '#111111',
                    },
                  ]}
                >
                  {kycReminder.actionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

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
    backgroundColor: '#fff6e5',
    padding: 20,
    gap: 12,
  },
  kycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycTitleGroup: {
    flex: 1,
    gap: 2,
  },
  kycTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  kycStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kycHeadline: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  kycDescription: {
    fontSize: 14,
    color: '#555555',
  },
  kycButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f6a609',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  kycButtonDisabled: {
    opacity: 0.6,
  },
  kycButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
