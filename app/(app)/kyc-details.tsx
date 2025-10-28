import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import {
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

const createInitialDocumentState = (): DocumentState => ({
  previewUri: null,
  asset: null,
  existingUrl: null,
});

const documentSections: {
  slot: KycDocumentSlot;
  title: string;
  helper: string;
}[] = [
  {
    slot: 'front',
    title: 'Front of ID card',
    helper: 'Ensure the text is readable and the photo is sharp.',
  },
  {
    slot: 'back',
    title: 'Back of ID card',
    helper: 'Capture the back of your ID card without glare.',
  },
  {
    slot: 'selfie',
    title: 'Selfie with the ID card',
    helper: 'Hold the ID next to your face in good lighting.',
  },
];

export default function KycDetailsScreen() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [documents, setDocuments] = useState<Record<KycDocumentSlot, DocumentState>>({
    front: createInitialDocumentState(),
    back: createInitialDocumentState(),
    selfie: createInitialDocumentState(),
  });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadExistingDocuments = async () => {
      if (!session?.accessToken) {
        return;
      }

      setIsLoadingDocuments(true);

      try {
        const response = await fetchKycDocuments({
          accessToken: session.accessToken,
          tokenType: session.tokenType,
        });

        if (response && isActive) {
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
        if (isActive) {
          setIsLoadingDocuments(false);
        }
      }
    };

    loadExistingDocuments();

    return () => {
      isActive = false;
    };
  }, [session]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        documents.front.asset?.uri &&
          documents.back.asset?.uri &&
          documents.selfie.asset?.uri &&
          !isSubmitting
      ),
    [documents, isSubmitting]
  );

  const isBusy = isSubmitting || isLoadingDocuments;

  const updateDocument = (slot: KycDocumentSlot, updater: (state: DocumentState) => DocumentState) => {
    setDocuments((prev) => ({
      ...prev,
      [slot]: updater(prev[slot] ?? createInitialDocumentState()),
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
    setSuccessMessage(null);

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

      updateDocument(slot, () => ({
        previewUri: asset.uri,
        asset,
        existingUrl: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to select image. Please try again.';
      setErrorMessage(message);
    }
  };

  const handleRemoveDocument = (slot: KycDocumentSlot) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    updateDocument(slot, () => createInitialDocumentState());
  };

  const handleSubmit = async () => {
    if (!session?.accessToken) {
      setErrorMessage('You must be signed in to upload KYC documents.');
      return;
    }

    if (!canSubmit) {
      setErrorMessage('Please select all required images before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await uploadKycDocuments({
        accessToken: session.accessToken,
        tokenType: session.tokenType,
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
          {isLoadingDocuments && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color="#111111" size="small" />
              <Text style={styles.loadingText}>Loading existing documents…</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upload your documents</Text>
            <Text style={styles.sectionSubtitle}>
              Capture or select clear photos of your identification. All three images are required.
            </Text>
          </View>

          <View style={styles.documentsContainer}>
            {documentSections.map((section) => {
              const state = documents[section.slot];

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

                  <View style={styles.documentActions}>
                    <TouchableOpacity
                      style={[styles.documentActionButton, isBusy && styles.documentActionButtonDisabled]}
                      onPress={() => handleDocumentSelection(section.slot, 'camera')}
                      disabled={isBusy}
                    >
                      <Ionicons name="camera-outline" size={18} color="#111111" />
                      <Text style={styles.documentActionText}>Use camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.documentActionButton, isBusy && styles.documentActionButtonDisabled]}
                      onPress={() => handleDocumentSelection(section.slot, 'library')}
                      disabled={isBusy}
                    >
                      <Ionicons name="images-outline" size={18} color="#111111" />
                      <Text style={styles.documentActionText}>Choose photo</Text>
                    </TouchableOpacity>
                  </View>

                  {state.existingUrl && !state.asset && (
                    <Text style={styles.existingNotice}>Previously uploaded document on file.</Text>
                  )}
                </View>
              );
            })}
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          {successMessage && <Text style={styles.successText}>{successMessage}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => router.back()}
            disabled={isBusy}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={[styles.buttonText, styles.primaryText]}>Submit Documents</Text>
            )}
          </TouchableOpacity>
        </View>
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
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 14,
    color: '#6f6f6f',
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
  sectionHeader: {
    gap: 8,
    marginTop: 12,
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
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: '#a1a1a1',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  documentActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  documentActionButtonDisabled: {
    opacity: 0.5,
  },
  documentActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  existingNotice: {
    fontSize: 12,
    color: '#5a5a5a',
  },
  errorText: {
    fontSize: 13,
    color: '#d9534f',
    fontWeight: '600',
  },
  successText: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  primaryButtonDisabled: {
    opacity: 0.4,
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
