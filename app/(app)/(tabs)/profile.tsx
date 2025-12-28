import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileSettingsModal from '@/components/modals/ProfileSettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import { getMyKycDetails, type CustomerKycDetails } from '@/services/kyc';
import styles from '@/style/profile.styles';

const formatAccountStatus = (status?: string | null) => {
  if (!status) {
    return 'Không xác định';
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
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const openSettings = useCallback(() => {
    setIsSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsVisible(false);
  }, []);

  const handleUpdateProfilePress = useCallback(() => {
    closeSettings();
    router.push('/(app)/update-profile');
  }, [closeSettings, router]);

  const handleAddShippingAddressPress = useCallback(() => {
    closeSettings();
    router.push('/(app)/shipping-addresses');
  }, [closeSettings, router]);

  const handleManageBankInfoPress = useCallback(() => {
    closeSettings();
    router.push('/(app)/bank-informations');
  }, [closeSettings, router]);

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
        throw new Error('Vui lòng đăng nhập lại để xem thông tin KYC.');
      }

      const details = await getMyKycDetails({
        accessToken: session.accessToken,
        tokenType: session.tokenType,
      });

      setKycDetails(details);

      return details;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể tải thông tin KYC. Vui lòng thử lại sau.';
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
          : 'Không thể làm mới hồ sơ. Vui lòng thử lại.';
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
        label: 'Mã khách hàng',
        value: `#${user.customerId}`,
        icon: 'pricetag-outline' as const,
      },
      {
        id: 'username',
        label: 'Tên đăng nhập',
        value: user.username,
        icon: 'person-outline' as const,
      },
      {
        id: 'email',
        label: 'Email',
        value: user.email ?? 'Chưa cung cấp',
        icon: 'mail-outline' as const,
      },
      {
        id: 'phone',
        label: 'Số điện thoại',
        value:
          user.phoneNumber && user.phoneNumber.trim().length > 0
            ? user.phoneNumber
            : 'Chưa cung cấp',
        icon: 'call-outline' as const,
      },
      {
        id: 'status',
        label: 'Trạng thái tài khoản',
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
          ? `Danh tính của bạn đã được xác minh vào ${verifiedAt}.`
          : 'Danh tính của bạn đã được xác minh. Bạn có thể thuê thiết bị.',
        actionLabel: null,
        actionType: null,
      } as const;
    }

    if (normalizedKycStatus === 'DOCUMENTS_SUBMITTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.kycStatusBadgeWarning,
        badgeTextStyle: styles.kycStatusBadgeTextWarning,
        description: 'Cảm ơn bạn! Hồ sơ của bạn đã được gửi và đang chờ xét duyệt.',
        actionLabel: 'Làm mới trạng thái',
        actionType: 'refresh' as const,
      } as const;
    }

    if (normalizedKycStatus === 'NOT_STARTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.kycStatusBadgeDanger,
        badgeTextStyle: styles.kycStatusBadgeTextDanger,
        description: 'Hoàn tất xác minh danh tính để được phê duyệt nhanh hơn.',
        actionLabel: 'Bắt đầu xác minh KYC',
        actionType: 'start' as const,
      } as const;
    }

    return {
      friendlyStatus,
      badgeStyle: styles.kycStatusBadgeNeutral,
      badgeTextStyle: styles.kycStatusBadgeTextNeutral,
      description: 'Giữ hồ sơ của bạn cập nhật để tránh chậm trễ khi thuê.',
      actionLabel: 'Làm mới trạng thái',
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
          <Text style={styles.unauthTitle}>Đăng nhập để xem hồ sơ của bạn</Text>
          <Text style={styles.unauthSubtitle}>
            Truy cập đơn hàng, quản lý hợp đồng thuê và cập nhật thông tin tài khoản sau khi đăng nhập.
          </Text>
          <TouchableOpacity
            style={[styles.authButton, styles.authPrimaryButton]}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={[styles.authButtonText, styles.authPrimaryButtonText]}>Đăng nhập</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.authSecondaryButton]}
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text style={[styles.authButtonText, styles.authSecondaryButtonText]}>Tạo tài khoản</Text>
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
          <Text style={styles.profileErrorTitle}>Không thể tải hồ sơ của bạn</Text>
          <Text style={styles.profileErrorSubtitle}>
            {profileError ?? 'Không thể lấy thông tin tài khoản. Vui lòng thử lại.'}
          </Text>
          <TouchableOpacity
            style={[styles.authButton, styles.authPrimaryButton]}
            onPress={() => void handleRefreshProfile()}
            disabled={isFetchingProfile}
          >
            <Text style={[styles.authButtonText, styles.authPrimaryButtonText]}>
              {isFetchingProfile ? 'Đang làm mới…' : 'Thử lại'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButton, styles.authSecondaryButton]}
            onPress={() => void handleLogout()}
            disabled={isFetchingProfile}
          >
            <Text style={[styles.authButtonText, styles.authSecondaryButtonText]}>Đăng xuất</Text>
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
          <Text style={styles.headerTitle}>Hồ sơ người dùng</Text>
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
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={openSettings}
              accessibilityLabel="Open profile settings"
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={22} color="#111" />
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
          <Text style={styles.profileEmail}>{user.email ?? 'Email không có sẵn'}</Text>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Khách hàng #{user.customerId}</Text>
          </View>
        </View>

        <View style={styles.selfieCard}>
          <MaterialCommunityIcons
            name={isAccountActive ? 'shield-check' : 'shield-alert'}
            size={28}
            color={isAccountActive ? '#16a34a' : '#dc2626'}
          />
          <Text style={styles.selfieTitle}>Trạng thái tài khoản</Text>
          <Text style={styles.selfieSubtitle}>
            {isAccountActive
              ? 'Tài khoản của bạn đang hoạt động và sẵn sàng để thuê.'
              : 'Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ hỗ trợ.'}
          </Text>
          <Text style={styles.selfieStatus}>{formatAccountStatus(user.status)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
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
            <Text style={styles.kycTitle}>Xác minh danh tính</Text>
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
                  <Text style={styles.kycLinkTitle}>Xem hồ sơ KYC của tôi</Text>
                  <Text style={styles.kycLinkSubtitle}>
                    Xem ảnh và thông tin bạn đã gửi để xác minh.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ) : !kycError && !isLoadingKyc ? (
            <Text style={styles.kycPlaceholderText}>
              {normalizedKycStatus === 'NOT_STARTED'
                ? 'Bạn chưa bắt đầu quy trình KYC.'
                : 'Không tìm thấy hồ sơ KYC cho tài khoản của bạn.'}
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
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
      <ProfileSettingsModal
        visible={isSettingsVisible}
        onClose={closeSettings}
        onUpdateProfile={handleUpdateProfilePress}
        onAddShippingAddress={handleAddShippingAddressPress}
        onManageBankInfo={handleManageBankInfoPress}
      />
    </SafeAreaView>
  );
}



