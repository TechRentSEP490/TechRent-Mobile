import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const buildDocumentRows = (details: CustomerKycDetails | null) => [
  {
    key: 'fullName',
    label: 'Full name',
    value:
      details?.fullName && details.fullName.trim().length > 0 ? details.fullName.trim() : 'Not provided',
  },
  {
    key: 'identificationCode',
    label: 'Identification number',
    value:
      details?.identificationCode && details.identificationCode.trim().length > 0
        ? details.identificationCode.trim()
        : 'Not provided',
  },
  {
    key: 'typeOfIdentification',
    label: 'Document type',
    value:
      details?.typeOfIdentification && details.typeOfIdentification.trim().length > 0
        ? details.typeOfIdentification.trim()
        : 'Not provided',
  },
  {
    key: 'permanentAddress',
    label: 'Permanent address',
    value:
      details?.permanentAddress && details.permanentAddress.trim().length > 0
        ? details.permanentAddress.trim()
        : 'Not provided',
  },
  {
    key: 'verifiedAt',
    label: 'Verified at',
    value: formatDateTime(details?.verifiedAt) ?? 'Not available',
  },
];

export default function KycStatusScreen() {
  const router = useRouter();
  const { ensureSession } = useAuth();
  const [details, setDetails] = useState<CustomerKycDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ label: string; uri: string } | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const loadDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await ensureSession();

      if (!session?.accessToken) {
        throw new Error('Please sign in again to view your KYC documents.');
      }

      const response = await getMyKycDetails({
        accessToken: session.accessToken,
        tokenType: session.tokenType,
      });

      setDetails(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load your KYC details. Please try again later.';
      setError(message);
      setDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [ensureSession]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const statusBadgeStyles = useMemo(() => {
    const normalizedStatus = (details?.kycStatus ?? 'NOT_STARTED').toUpperCase();
    const friendlyStatus = formatAccountStatus(normalizedStatus);

    if (normalizedStatus === 'VERIFIED') {
      return {
        friendlyStatus,
        badgeStyle: styles.statusBadgeSuccess,
        textStyle: styles.statusBadgeTextSuccess,
      } as const;
    }

    if (normalizedStatus === 'DOCUMENTS_SUBMITTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.statusBadgeWarning,
        textStyle: styles.statusBadgeTextWarning,
      } as const;
    }

    if (normalizedStatus === 'NOT_STARTED') {
      return {
        friendlyStatus,
        badgeStyle: styles.statusBadgeDanger,
        textStyle: styles.statusBadgeTextDanger,
      } as const;
    }

    return {
      friendlyStatus,
      badgeStyle: styles.statusBadgeNeutral,
      textStyle: styles.statusBadgeTextNeutral,
    } as const;
  }, [details?.kycStatus]);

  const documentRows = useMemo(() => buildDocumentRows(details), [details]);

  const handlePreviewDocument = useCallback((label: string, uri: string | null | undefined) => {
    if (!uri) {
      return;
    }

    setPreview({ label, uri });
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const previewImageDimensions = useMemo(() => {
    const maxWidth = Math.min(windowWidth - 64, 420);
    const aspectRatio = 3 / 4;
    const derivedHeight = maxWidth / aspectRatio;
    const maxHeight = windowHeight * 0.65;
    const height = Math.min(derivedHeight, maxHeight);
    const width = height * aspectRatio;

    return { width, height };
  }, [windowHeight, windowWidth]);

  const renderDocument = useCallback(
    (label: string, uri: string | null | undefined) => (
      <TouchableOpacity
        key={label}
        style={[styles.documentItem, !uri && styles.documentItemDisabled]}
        onPress={() => handlePreviewDocument(label, uri)}
        activeOpacity={0.85}
        disabled={!uri}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.documentImage} contentFit="cover" />
        ) : (
          <View style={styles.documentPlaceholder}>
            <Ionicons name="image-outline" size={28} color="#9ca3af" />
          </View>
        )}
        <Text style={styles.documentLabel}>{label}</Text>
        <Text style={styles.documentHint}>{uri ? 'Tap to preview this document.' : 'Document not submitted yet.'}</Text>
      </TouchableOpacity>
    ),
    [handlePreviewDocument],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My KYC Documents</Text>
          <TouchableOpacity
            style={[styles.headerAction, isLoading && styles.headerActionDisabled]}
            onPress={() => void loadDetails()}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator size="small" color="#111111" /> : <Ionicons name="refresh" size={18} color="#111111" />}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#7f1d1d" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void loadDetails()} tintColor="#111111" colors={["#111111"]} />
          }
        >
          <View style={[styles.statusBadge, statusBadgeStyles.badgeStyle]}>
            <Text style={[styles.statusBadgeText, statusBadgeStyles.textStyle]}>{statusBadgeStyles.friendlyStatus}</Text>
          </View>

          <Text style={styles.sectionTitle}>Account details</Text>
          <View style={styles.infoList}>
            {documentRows.map((row, index) => (
              <View
                key={row.key}
                style={[styles.infoRow, index === documentRows.length - 1 && styles.infoRowLast]}
              >
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Submitted documents</Text>
          <View style={styles.documentGrid}>
            {['Front of ID', 'Back of ID', 'Selfie with ID'].map((label, index) => {
              const uri =
                index === 0
                  ? details?.frontCCCDUrl
                  : index === 1
                  ? details?.backCCCDUrl
                  : details?.selfieUrl;
              return renderDocument(label, uri ?? null);
            })}
          </View>

          {!details && !isLoading && !error ? (
            <Text style={styles.placeholderText}>
              We could not find any submitted documents for your account yet.
            </Text>
          ) : null}
        </ScrollView>
      </View>

      {preview ? (
        <Modal transparent animationType="fade" visible onRequestClose={closePreview}>
          <View style={styles.previewBackdrop}>
            <View style={styles.previewContent}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>{preview.label}</Text>
                <TouchableOpacity
                  style={styles.previewCloseButton}
                  onPress={closePreview}
                  accessibilityRole="button"
                  accessibilityLabel="Close document preview"
                >
                  <Ionicons name="close" size={20} color="#111111" />
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: preview.uri }}
                style={[styles.previewImage, previewImageDimensions]}
                contentFit="contain"
              />
              <Text style={styles.previewHint}>Use the close button to return to your documents.</Text>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeNeutral: {
    backgroundColor: '#e5e7eb',
  },
  statusBadgeTextSuccess: {
    color: '#166534',
  },
  statusBadgeTextWarning: {
    color: '#92400e',
  },
  statusBadgeTextDanger: {
    color: '#b91c1c',
  },
  statusBadgeTextNeutral: {
    color: '#1f2937',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  infoList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 6,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 15,
    color: '#111111',
  },
  documentGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  documentItem: {
    width: '30%',
    minWidth: 110,
    flexGrow: 1,
    gap: 8,
  },
  documentItemDisabled: {
    opacity: 0.6,
  },
  documentImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  documentPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  documentHint: {
    fontSize: 11,
    color: '#6b7280',
  },
  placeholderText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewContent: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 16,
  },
  previewHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  previewCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    backgroundColor: '#0f172a',
  },
  previewHint: {
    fontSize: 12,
    color: '#e5e7eb',
    textAlign: 'center',
  },
});
