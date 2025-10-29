import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  KYC_DOCUMENT_SLOTS,
  decodeKycDocumentsParam,
  encodeKycDocumentsParam,
  fetchKycDocuments,
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
    helper: 'Make sure the text and image are sharp and readable.',
  },
  {
    slot: 'back',
    title: 'Back of ID card',
    helper: 'Capture the back of the card without glare or shadows.',
  },
  {
    slot: 'selfie',
    title: 'Selfie with the ID card',
    helper: 'Hold the ID next to your face in a well-lit area.',
  },
];

const createInitialDocumentState = (): DocumentState => ({
  previewUri: null,
  asset: null,
  existingUrl: null,
});

export default function KycDocumentsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { docs: docsParam } = useLocalSearchParams<{ docs?: string }>();

  const [documents, setDocuments] = useState<Record<KycDocumentSlot, DocumentState>>({
    front: createInitialDocumentState(),
    back: createInitialDocumentState(),
    selfie: createInitialDocumentState(),
  });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [hasFetchedExisting, setHasFetchedExisting] = useState(false);
  const [hasSeededFromParams, setHasSeededFromParams] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session?.accessToken || hasFetchedExisting || !hasSeededFromParams) {
      return;
    }

    if (hasAllAssets) {
      setHasFetchedExisting(true);
      return;
    }

    let isMounted = true;

    const loadExistingDocuments = async () => {
      setIsLoadingDocuments(true);

      try {
        const response = await fetchKycDocuments({
          accessToken: session.accessToken,
          tokenType: session.tokenType,
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
  }, [hasAllAssets, hasFetchedExisting, hasSeededFromParams, session?.accessToken, session?.tokenType]);

  const resetDocument = (slot: KycDocumentSlot) => {
    setDocuments((prev) => ({
      ...prev,
      [slot]: createInitialDocumentState(),
    }));
  };

  const updateDocument = (slot: KycDocumentSlot, state: DocumentState) => {
    setDocuments((prev) => ({
      ...prev,
      [slot]: state,
    }));
  };

  const requestPermission = async (source: 'camera' | 'library') => {
    const result =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!result.granted) {
      throw new Error(
        source === 'camera'
          ? 'Camera access is required to capture your identification.'
          : 'Photo library access is required to select your identification.'
      );
    }
  };

  const normalizeAsset = (slot: KycDocumentSlot, asset: ImagePicker.ImagePickerAsset): KycDocumentAsset => {
    const fileName = asset.fileName && asset.fileName.length > 0
      ? asset.fileName
      : `${slot}-${Date.now()}.${asset.uri?.split('.').pop() ?? 'jpg'}`;

    const inferredType = asset.mimeType ?? (fileName.endsWith('.png') ? 'image/png' : 'image/jpeg');

    return {
      uri: asset.uri,
      name: fileName,
      type: inferredType,
    };
  };

  const handleDocumentSelection = async (slot: KycDocumentSlot, source: 'camera' | 'library') => {
    setErrorMessage(null);

    try {
      await requestPermission(source);

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
              allowsEditing: false,
            });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = normalizeAsset(slot, result.assets[0]);

      updateDocument(slot, {
        previewUri: asset.uri,
        asset,
        existingUrl: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to select image. Please try again.';
      setErrorMessage(message);
    }
  };

  const handleRemoveDocument = (slot: KycDocumentSlot) => {
    setErrorMessage(null);
    resetDocument(slot);
  };

  const hasAllAssets = useMemo(
    () =>
      KYC_DOCUMENT_SLOTS.every((slot) => {
        const asset = documents[slot].asset;
        return Boolean(asset?.uri && asset.uri.length > 0);
      }),
    [documents]
  );

  const canContinue = hasAllAssets && !isLoadingDocuments;

  const handleContinue = () => {
    if (!canContinue) {
      setErrorMessage('Please capture all required documents before continuing.');
      return;
    }

    const payload = encodeKycDocumentsParam({
      front: documents.front.asset!,
      back: documents.back.asset!,
      selfie: documents.selfie.asset!,
    });

    router.push({
      pathname: '/(app)/kyc-details',
      params: { docs: payload },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>KYC Verification</Text>
            <Text style={styles.subtitle}>
              Capture clear photos of your identification. You can retake or replace any image before
              continuing.
            </Text>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#b91c1c" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {isLoadingDocuments && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color="#111111" size="small" />
              <Text style={styles.loadingText}>Loading existing documents…</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Take your photos</Text>
            <Text style={styles.sectionSubtitle}>
              Use the camera or select from your photo library. All three documents are required.
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
                        onPress={() => handleRemoveDocument(section.slot)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#d9534f" />
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.previewWrapper}>
                    {state.previewUri ? (
                      <Image source={{ uri: state.previewUri }} style={styles.previewImage} contentFit="cover" />
                    ) : (
                      <View style={styles.placeholder}>
                        <Ionicons name="image-outline" size={32} color="#a1a1a1" />
                        <Text style={styles.placeholderText}>No image selected</Text>
                      </View>
                    )}
                  </View>

                  {requiresRetake && (
                    <View style={styles.noticeBanner}>
                      <Ionicons name="refresh" size={16} color="#92400e" />
                      <Text style={styles.noticeText}>Retake this photo to resubmit your documents.</Text>
                    </View>
                  )}

                  <View style={styles.documentActions}>
                    <TouchableOpacity
                      style={styles.documentActionButton}
                      onPress={() => handleDocumentSelection(section.slot, 'camera')}
                    >
                      <Ionicons name="camera-outline" size={18} color="#111111" />
                      <Text style={styles.documentActionText}>Use camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.documentActionButton}
                      onPress={() => handleDocumentSelection(section.slot, 'library')}
                    >
                      <Ionicons name="image-outline" size={18} color="#111111" />
                      <Text style={styles.documentActionText}>Choose photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, !canContinue && styles.disabledButton]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text style={[styles.buttonText, styles.primaryText]}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  scrollContent: {
    paddingBottom: 24,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6f6f6f',
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
  documentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  documentActionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  documentActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#111111',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: '#111111',
  },
  primaryText: {
    color: '#ffffff',
  },
});
