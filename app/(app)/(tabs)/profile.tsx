import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
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
import { formatKycStatusLabel, getKycProgressState } from '@/constants/kyc';

const formatRole = (role?: string | null) => {
  if (!role || role.trim().length === 0) {
    return 'Customer';
  }

  return role
    .split(/[_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
};

const formatStatus = (status?: string | null) => {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split(/[_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
};

type KycReminderVariant = 'reminder' | 'pending' | 'verified' | 'attention';

type KycReminderContent = {
  icon: { name: ComponentProps<typeof Ionicons>['name']; color: string };
  title: string;
  description: string;
  primaryAction: {
    label: string;
    route: `/(app)/${string}`;
    variant: 'primary' | 'dark' | 'outline' | 'danger';
  };
  cardVariant: KycReminderVariant;
};

const getKycReminderContent = (status?: string | null): KycReminderContent => {
  const progress = getKycProgressState(status);

  switch (progress) {
    case 'pending':
      return {
        icon: { name: 'time-outline', color: '#4338ca' },
        title: 'KYC Under Review',
        description: 'We received your documents and are currently reviewing them. You can review what you sent while you wait.',
        primaryAction: {
          label: 'View KYC Information',
          route: '/(app)/kyc-details',
          variant: 'dark',
        },
        cardVariant: 'pending',
      };
    case 'verified':
      return {
        icon: { name: 'shield-checkmark-outline', color: '#047857' },
        title: 'KYC Verified',
        description: 'Your identity has been verified. Feel free to review your submitted documents at any time.',
        primaryAction: {
          label: 'View KYC Information',
          route: '/(app)/kyc-details',
          variant: 'outline',
        },
        cardVariant: 'verified',
      };
    case 'rejected':
      return {
        icon: { name: 'alert-circle-outline', color: '#b91c1c' },
        title: 'KYC Needs Attention',
        description: 'We could not verify your documents. Please review them and resubmit so we can activate your rentals.',
        primaryAction: {
          label: 'Update KYC Documents',
          route: '/(app)/kyc-details',
          variant: 'danger',
        },
        cardVariant: 'attention',
      };
    default:
      return {
        icon: { name: 'shield-checkmark-outline', color: '#b45309' },
        title: 'Complete Your KYC',
        description: 'Verify your identity to unlock rentals and keep your account secure.',
        primaryAction: {
          label: 'Start KYC',
          route: '/(app)/kyc-documents',
          variant: 'primary',
        },
        cardVariant: 'reminder',
      };
  }
};

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

  const handleOpenSettings = useCallback(() => {
    router.push('/(app)/profile-settings');
  }, [router]);

  const handleKycAction = useCallback(
    (route: `/(app)/${string}`) => {
      router.push(route);
    },
    [router]
  );

  const contactItems = useMemo(() => {
    if (!user) {
      return [];
    }

    const normalizedFullName =
      user.fullName && user.fullName.trim().length > 0 && user.fullName.trim().toLowerCase() !== 'chưa cập nhật'
        ? user.fullName
        : 'Not provided';

    return [
      {
        id: 'customerId',
        label: 'Customer ID',
        value: String(user.customerId),
        icon: 'finger-print-outline' as const,
      },
      {
        id: 'accountId',
        label: 'Account ID',
        value: String(user.accountId),
        icon: 'key-outline' as const,
      },
      {
        id: 'fullName',
        label: 'Full Name',
        value: normalizedFullName,
        icon: 'reader-outline' as const,
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
        id: 'role',
        label: 'Role',
        value: formatRole(user.role),
        icon: 'briefcase-outline' as const,
      },
      {
        id: 'status',
        label: 'Account Status',
        value: formatStatus(user.status),
        icon: 'information-circle-outline' as const,
      },
      {
        id: 'kycStatus',
        label: 'KYC Status',
        value: formatKycStatusLabel(user.kycStatus),
        icon: 'shield-checkmark-outline' as const,
      },
    ];
  }, [user]);

  const kycReminder = useMemo(() => getKycReminderContent(user?.kycStatus), [user?.kycStatus]);

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
            <TouchableOpacity style={styles.headerActionButton} onPress={handleOpenSettings}>
              <Ionicons name="settings-outline" size={20} color="#111" />
            </TouchableOpacity>
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
          <Text style={styles.profileName}>{user.username}</Text>
          <Text style={styles.profileEmail}>{user.email ?? 'Email unavailable'}</Text>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{formatRole(user.role)}</Text>
          </View>
        </View>

        <View style={styles.selfieCard}>
          <MaterialCommunityIcons
            name={user.isActive ? 'shield-check' : 'shield-alert'}
            size={28}
            color={user.isActive ? '#16a34a' : '#dc2626'}
          />
          <Text style={styles.selfieTitle}>Account Status</Text>
          <Text style={styles.selfieSubtitle}>
            {user.isActive
              ? `Your account is ${formatStatus(user.status)} and ready for rentals.`
              : 'Your account is currently inactive. Please contact support for assistance.'}
          </Text>
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

        <View
          style={[
            styles.kycCard,
            kycReminder.cardVariant === 'pending' && styles.kycCardPending,
            kycReminder.cardVariant === 'verified' && styles.kycCardVerified,
            kycReminder.cardVariant === 'attention' && styles.kycCardAttention,
          ]}
        >
          <View style={styles.kycHeader}>
            <Ionicons name={kycReminder.icon.name} size={24} color={kycReminder.icon.color} />
            <Text style={styles.kycTitle}>{kycReminder.title}</Text>
          </View>
          <Text style={styles.kycDescription}>{kycReminder.description}</Text>
          <View style={styles.kycActions}>
            <TouchableOpacity
              style={[
                styles.kycButton,
                kycReminder.primaryAction.variant === 'primary' && styles.kycButtonPrimary,
                kycReminder.primaryAction.variant === 'dark' && styles.kycButtonDark,
                kycReminder.primaryAction.variant === 'outline' && styles.kycButtonOutline,
                kycReminder.primaryAction.variant === 'danger' && styles.kycButtonDanger,
              ]}
              onPress={() => handleKycAction(kycReminder.primaryAction.route)}
            >
              <Text
                style={[
                  styles.kycButtonText,
                  kycReminder.primaryAction.variant === 'dark' ||
                    kycReminder.primaryAction.variant === 'danger'
                    ? styles.kycButtonTextLight
                    : styles.kycButtonTextDark,
                ]}
              >
                {kycReminder.primaryAction.label}
              </Text>
            </TouchableOpacity>
          </View>
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
  kycCardPending: {
    backgroundColor: '#eef2ff',
  },
  kycCardVerified: {
    backgroundColor: '#ecfdf5',
  },
  kycCardAttention: {
    backgroundColor: '#fef2f2',
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
  },
  kycDescription: {
    fontSize: 14,
    color: '#555555',
  },
  kycActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kycButton: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  kycButtonPrimary: {
    backgroundColor: '#f6a609',
    borderColor: '#f6a609',
  },
  kycButtonDark: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  kycButtonOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#111111',
  },
  kycButtonDanger: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  kycButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  kycButtonTextDark: {
    color: '#111111',
  },
  kycButtonTextLight: {
    color: '#ffffff',
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
