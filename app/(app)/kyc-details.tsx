import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { formatKycStatusLabel, getKycProgressState } from '@/constants/kyc';
import {
  KYC_DOCUMENT_SLOTS,
  decodeKycDocumentsParam,
  encodeKycDocumentsParam,
  fetchKycDocuments,
  uploadKycDocuments,
  type KycDocumentAsset,
  type KycDocumentSlot,
} from '@/services/kyc';

type DocumentState = {
  previewUri: string | null;
  asset: KycDocumentAsset | null;
  existingUrl: string | null;
};

type DocumentSection = {
  slot: KycDocumentSlot;
  title: string;
  helper: string;
};

const documentSections: DocumentSection[] = [
  {
    slot: 'front',
    title: 'Front of ID card',
    helper: 'Confirm the front side is clearly visible and legible.',
  },
  {
    slot: 'back',
    title: 'Back of ID card',
    helper: 'Ensure the card details are readable without glare.',
  },
  {
    slot: 'selfie',
    title: 'Selfie with the ID card',
    helper: 'Your face and the ID should both be inside the frame.',
  },
];

const createInitialDocumentState = (): DocumentState => ({
  previewUri: null,
  asset: null,
  existingUrl: null,
});

export default function KycDetailsScreen() {
  const router = useRouter();
  const { session, refreshProfile, user, ensureSession } = useAuth();
  const { docs: docsParam } = useLocalSearchParams<{ docs?: string }>();

  const [fullName, setFullName] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [documents, setDocuments] = useState<Record<KycDocumentSlot, DocumentState>>({
    front: createInitialDocumentState(),
    back: createInitialDocumentState(),
    selfie: createInitialDocumentState(),
  });
  const [hasSeededFromParams, setHasSeededFromParams] = useState(false);
  const [hasFetchedExisting, setHasFetchedExisting] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const kycStatusLabel = useMemo(() => formatKycStatusLabel(user?.kycStatus), [user?.kycStatus]);
  const kycProgress = useMemo(() => getKycProgressState(user?.kycStatus), [user?.kycStatus]);
  const kycStatusMessage = useMemo(() => {
    switch (kycProgress) {
      case 'pending':
        return "We're reviewing your documents. We'll notify you once verification is complete.";
      case 'verified':
        return 'Everything looks good. You can still update your documents if anything changes.';
      case 'rejected':
        return 'We need clearer or updated documents. Submit new photos below to continue.';
      default:
        return 'Upload the required documents below to start the verification process.';
    }
  }, [kycProgress]);

  const kycStatusIcon = useMemo(() => {
    switch (kycProgress) {
      case 'pending':
        return { name: 'time-outline' as const, color: '#4338ca' };
      case 'verified':
        return { name: 'shield-checkmark' as const, color: '#047857' };
      case 'rejected':
        return { name: 'alert-circle-outline' as const, color: '#b91c1c' };
      default:
        return { name: 'shield-checkmark-outline' as const, color: '#b45309' };
    }
  }, [kycProgress]);

  useEffect(() => {
    if (hasSeededFromParams) {
      return;
    }

    const parsed = decodeKycDocumentsParam(docsParam);

    if (parsed) {
      setDocuments({
        front: {
          previewUri: parsed.front.uri ?? null,
          asset: parsed.front,
          existingUrl: null,
        },
        back: {
          previewUri: parsed.back.uri ?? null,
          asset: parsed.back,
          existingUrl: null,
        },
        selfie: {
          previewUri: parsed.selfie.uri ?? null,
          asset: parsed.selfie,
          existingUrl: null,
        },
      });
    }

    setHasSeededFromParams(true);
  }, [docsParam, hasSeededFromParams]);

  const hasProvidedAssets = useMemo(
    () =>
      KYC_DOCUMENT_SLOTS.every((slot) => {
        const asset = documents[slot].asset;
        return Boolean(asset?.uri && asset.uri.length > 0);
      }),
    [documents]
  );

  useEffect(() => {
    if (!hasSeededFromParams || hasFetchedExisting) {
      return;
    }

    if (hasProvidedAssets) {
      setHasFetchedExisting(true);
      return;
    }

    let isMounted = true;

    const loadExistingDocuments = async () => {
      const activeSession = session?.accessToken ? session : await ensureSession();

      if (!activeSession?.accessToken) {
        return;
      }

      setIsLoadingDocuments(true);

      try {
        const response = await fetchKycDocuments({
          accessToken: activeSession.accessToken,
          tokenType: activeSession.tokenType,
        });

        if (response && isMounted) {
          setDocuments({
            front: {
              previewUri: response.frontUrl,
              asset: null,
              existingUrl: response.frontUrl,
            },
            back: {
              previewUri: response.backUrl,
              asset: null,
              existingUrl: response.backUrl,
            },
            selfie: {
              previewUri: response.selfieUrl,
              asset: null,
              existingUrl: response.selfieUrl,
            },
          });

          if (response.fullName && response.fullName.length > 0) {
            setFullName((prev) => (prev.length > 0 ? prev : response.fullName ?? ''));
          }
        }
      } catch (error) {
        console.warn('Failed to load existing KYC documents', error);
      } finally {
        if (isMounted) {
          setIsLoadingDocuments(false);
          setHasFetchedExisting(true);
        }
      }
    };

    loadExistingDocuments();

    return () => {
      isMounted = false;
    };
  }, [ensureSession, hasFetchedExisting, hasProvidedAssets, hasSeededFromParams, session]);

  const canSubmit = useMemo(() => hasProvidedAssets && !isSubmitting, [hasProvidedAssets, isSubmitting]);

  const handleSubmit = async () => {
    const activeSession = session?.accessToken ? session : await ensureSession();

    if (!activeSession?.accessToken) {
      setErrorMessage('Your session has expired. Please sign in again to upload KYC documents.');
      return;
    }

    if (!hasProvidedAssets) {
      setErrorMessage('Please add photos for all required documents before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await uploadKycDocuments({
        accessToken: activeSession.accessToken,
        tokenType: activeSession.tokenType,
        documents: {
          front: documents.front.asset!,
          back: documents.back.asset!,
          selfie: documents.selfie.asset!,
        },
      });

      setSuccessMessage('Your KYC documents were uploaded successfully.');

      if (result) {
        setDocuments({
          front: {
            previewUri: result.frontUrl ?? documents.front.asset?.uri ?? null,
            asset: null,
            existingUrl: result.frontUrl ?? null,
          },
          back: {
            previewUri: result.backUrl ?? documents.back.asset?.uri ?? null,
            asset: null,
            existingUrl: result.backUrl ?? null,
          },
          selfie: {
            previewUri: result.selfieUrl ?? documents.selfie.asset?.uri ?? null,
            asset: null,
            existingUrl: result.selfieUrl ?? null,
          },
        });

        if (result.fullName && result.fullName.length > 0) {
          setFullName(result.fullName);
        }
      } else {
        setDocuments({
          front: createInitialDocumentState(),
          back: createInitialDocumentState(),
          selfie: createInitialDocumentState(),
        });
      }

      try {
        await refreshProfile();
      } catch (error) {
        console.warn('Failed to refresh profile after KYC upload', error);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload documents. Please try again later.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeDocuments = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (hasProvidedAssets) {
      const payload = encodeKycDocumentsParam({
        front: documents.front.asset!,
        back: documents.back.asset!,
        selfie: documents.selfie.asset!,
      });

      router.push({
        pathname: '/(app)/kyc-documents',
        params: { docs: payload },
      });

      return;
    }

    router.push('/(app)/kyc-documents');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>KYC Verification</Text>
            <Text style={styles.subtitle}>Enter your legal information to continue.</Text>
          </View>

          <View
            style={[
              styles.statusBanner,
              kycProgress === 'pending' && styles.statusBannerPending,
              kycProgress === 'verified' && styles.statusBannerVerified,
              kycProgress === 'rejected' && styles.statusBannerRejected,
            ]}
          >
            <View style={styles.statusIconWrapper}>
              <Ionicons name={kycStatusIcon.name} size={20} color={kycStatusIcon.color} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>{`Status: ${kycStatusLabel}`}</Text>
              <Text style={styles.statusSubtitle}>{kycStatusMessage}</Text>
            </View>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#b91c1c" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#047857" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {isLoadingDocuments && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color="#111111" size="small" />
              <Text style={styles.loadingText}>Loading your existing documents…</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Review your photos</Text>
              <TouchableOpacity onPress={handleRetakeDocuments} style={styles.retakeButton}>
                <Ionicons name="refresh" size={16} color="#111111" />
                <Text style={styles.retakeButtonText}>Retake photos</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Double-check that each image is clear. If you need to make changes, retake your photos before
              submitting.
            </Text>
          </View>

          <View style={styles.documentsContainer}>
            {documentSections.map((section) => {
              const state = documents[section.slot];
              const requiresRetake = Boolean(state.existingUrl && !state.asset);

              return (
                <View key={section.slot} style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <View>
                      <Text style={styles.documentTitle}>{section.title}</Text>
                      <Text style={styles.documentHelper}>{section.helper}</Text>
                    </View>
                    {state.previewUri && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                          setDocuments((prev) => ({
                            ...prev,
                            [section.slot]: createInitialDocumentState(),
                          }));
                        }}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#d9534f" />
                        <Text style={styles.removeButtonText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.previewWrapper}>
                    {state.previewUri ? (
                      <Image source={{ uri: state.previewUri }} style={styles.previewImage} contentFit="cover" />
                    ) : (
                      <View style={styles.placeholder}>
                        <Ionicons name="image-outline" size={32} color="#a1a1a1" />
                        <Text style={styles.placeholderText}>No image provided yet</Text>
                      </View>
                    )}
                  </View>

                  {requiresRetake && (
                    <View style={styles.noticeBanner}>
                      <Ionicons name="refresh" size={16} color="#92400e" />
                      <Text style={styles.noticeText}>Retake this photo on the previous screen before submitting.</Text>
                    </View>
                  )}

                  {!state.asset && !state.existingUrl && (
                    <View style={styles.noticeBannerMuted}>
                      <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                      <Text style={styles.noticeMutedText}>Add this document on the previous screen.</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#888888"
              value={fullName}
              onChangeText={setFullName}
            />
            <Text style={styles.helper}>Make sure to use your legal name</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Citizen ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your citizen ID"
              placeholderTextColor="#888888"
              value={citizenId}
              onChangeText={setCitizenId}
              keyboardType="number-pad"
            />
            <Text style={styles.helper}>This should match your official identification</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date of ID</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#888888"
              value={issuedDate}
              onChangeText={setIssuedDate}
            />
            <Text style={styles.helper}>Enter the date of issuance of your ID</Text>
          </View>

          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit documents</Text>
              )}
            </TouchableOpacity>
            {!hasProvidedAssets && (
              <Text style={styles.submitHelper}>
                Capture all required photos before completing your verification.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 14,
    color: '#6f6f6f',
    lineHeight: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'flex-start',
  },
  statusBannerPending: {
    backgroundColor: '#eef2ff',
  },
  statusBannerVerified: {
    backgroundColor: '#ecfdf5',
  },
  statusBannerRejected: {
    backgroundColor: '#fef2f2',
  },
  statusIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  statusContent: {
    flex: 1,
    gap: 6,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
  },
  successText: {
    fontSize: 13,
    color: '#047857',
    flex: 1,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#6f6f6f',
  },
  sectionHeader: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6f6f6f',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  documentsContainer: {
    gap: 16,
  },
  documentCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  documentHelper: {
    fontSize: 12,
    color: '#7a7a7a',
    marginTop: 4,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeButtonText: {
    fontSize: 13,
    color: '#d9534f',
    fontWeight: '600',
  },
  previewWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  placeholderText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  noticeText: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
  },
  noticeBannerMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  noticeMutedText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  fieldGroup: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  helper: {
    fontSize: 12,
    color: '#7a7a7a',
  },
  submitSection: {
    gap: 10,
  },
  submitButton: {
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitHelper: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
