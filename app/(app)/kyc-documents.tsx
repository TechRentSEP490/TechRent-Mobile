import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { scanFromURLAsync, VisionDetectorType } from 'expo-mlkit-vision';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { parseKycText, type ParsedKycFields } from '@/utils/kyc-parser';

type DocumentType = 'front' | 'back' | 'selfie';

type DocumentAsset = {
  uri: string;
  type: string;
  name: string;
};

type DocumentState = Record<DocumentType, DocumentAsset | null>;

type DocumentOcrState = {
  isProcessing: boolean;
  error: string | null;
  text: string;
};

type OcrStateMap = Record<'front' | 'back', DocumentOcrState>;

const initialDocumentState: DocumentState = {
  front: null,
  back: null,
  selfie: null,
};

const initialOcrState: OcrStateMap = {
  front: { isProcessing: false, error: null, text: '' },
  back: { isProcessing: false, error: null, text: '' },
};

const documentCopy: Record<DocumentType, { title: string; description: string }> = {
  front: {
    title: 'Front Side',
    description: 'Take or upload a clear photo of the front side of your ID.',
  },
  back: {
    title: 'Back Side',
    description: 'Capture the back side of your ID for verification.',
  },
  selfie: {
    title: 'Selfie with ID',
    description: 'Take a selfie while holding your ID next to your face.',
  },
};

const extractTextFromResult = (result: unknown): string => {
  if (!result) {
    return '';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (Array.isArray(result)) {
    return result.map((item) => extractTextFromResult(item)).filter(Boolean).join('\n');
  }

  if (typeof result === 'object') {
    const { text } = result as { text?: string };
    if (typeof text === 'string' && text.length > 0) {
      return text;
    }

    const blocks = (result as { blocks?: unknown }).blocks;
    if (blocks) {
      return extractTextFromResult(blocks);
    }

    const lines = (result as { lines?: unknown }).lines;
    if (lines) {
      return extractTextFromResult(lines);
    }

    const elements = (result as { elements?: unknown }).elements;
    if (elements) {
      return extractTextFromResult(elements);
    }
  }

  return '';
};

const buildFileName = (type: DocumentType, extension?: string) =>
  `kyc-${type}-${Date.now()}${extension ? `.${extension}` : ''}`;

const toDocumentAsset = (asset: ImagePicker.ImagePickerAsset, type: DocumentType): DocumentAsset => {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const extension = asset.fileName?.split('.').pop() ?? mimeType.split('/').pop() ?? 'jpg';

  return {
    uri: asset.uri,
    type: mimeType,
    name: asset.fileName ?? buildFileName(type, extension),
  };
};

const resolveTextDetector = () => {
  const detectors = VisionDetectorType as Record<string, unknown> | undefined;

  if (!detectors) {
    return undefined;
  }

  const fallback = Object.values(detectors).filter((value) => typeof value === 'string');

  return detectors.TextRecognition ?? detectors.Text ?? fallback[0];
};

const TEXT_DETECTOR = resolveTextDetector();

const DocumentCard = ({
  type,
  asset,
  isProcessing,
  error,
  onPress,
}: {
  type: DocumentType;
  asset: DocumentAsset | null;
  isProcessing: boolean;
  error: string | null;
  onPress: () => void;
}) => {
  const copy = documentCopy[type];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrapper}>
          <Ionicons name="cloud-upload-outline" size={22} color="#111" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{copy.title}</Text>
          <Text style={styles.cardSubtitle}>{copy.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#c1c1c1" />
      </View>

      <View style={styles.previewWrapper}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.previewImage} contentFit="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="image-outline" size={28} color="#9c9c9c" />
            <Text style={styles.previewPlaceholderText}>Tap to add photo</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        {isProcessing ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#111" />
            <Text style={styles.statusText}>Processing text…</Text>
          </View>
        ) : error ? (
          <View style={styles.statusRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#d64545" />
            <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
          </View>
        ) : asset ? (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={18} color="#1c8c4d" />
            <Text style={[styles.statusText, styles.successText]}>Photo ready</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>Tap to capture or upload</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function KycDocumentsScreen() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentState>(initialDocumentState);
  const [ocrState, setOcrState] = useState<OcrStateMap>(initialOcrState);
  const [detectedFields, setDetectedFields] = useState<ParsedKycFields>({});
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const isNextEnabled = useMemo(
    () =>
      Boolean(
        documents.front &&
          documents.back &&
          documents.selfie &&
          !ocrState.front.isProcessing &&
          !ocrState.back.isProcessing,
      ),
    [documents.back, documents.front, documents.selfie, ocrState.back.isProcessing, ocrState.front.isProcessing],
  );

  const ensurePermission = useCallback(async (type: 'camera' | 'library') => {
    setIsRequestingPermission(true);
    try {
      const permissionResult =
        type === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== 'granted') {
        Alert.alert(
          type === 'camera' ? 'Camera permission required' : 'Photo library permission required',
          'Please enable permissions in your device settings to continue.',
        );
        return false;
      }

      return true;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  const processOcr = useCallback(
    async (type: 'front' | 'back', asset: DocumentAsset) => {
      setOcrState((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          isProcessing: true,
          error: null,
        },
      }));

      try {
        const detectionResult = TEXT_DETECTOR
          ? await (scanFromURLAsync as any)(asset.uri, [TEXT_DETECTOR])
          : await (scanFromURLAsync as any)(asset.uri);
        const detectedText = extractTextFromResult(detectionResult);

        setOcrState((prev) => {
          const nextState: OcrStateMap = {
            ...prev,
            [type]: {
              ...prev[type],
              isProcessing: false,
              text: detectedText,
              error: null,
            },
          };

          const aggregatedText = [nextState.front.text, nextState.back.text]
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
            .join('\n');

          if (aggregatedText.length > 0) {
            const parsed = parseKycText(aggregatedText);
            setDetectedFields((prevFields) => ({
              ...prevFields,
              ...parsed,
            }));
          }

          return nextState;
        });
      } catch (error) {
        console.warn('OCR failed for document', type, error);
        setOcrState((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            isProcessing: false,
            error: 'Could not extract text. You can fill details manually later.',
          },
        }));
      }
    },
    [],
  );

  const handleImageSelection = useCallback(
    async (documentType: DocumentType, source: 'camera' | 'library') => {
      const hasPermission = await ensurePermission(source);
      if (!hasPermission) {
        return;
      }

      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 1,
              preferredAssetRepresentationMode:
                ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 1,
            });

      if (pickerResult.canceled || !pickerResult.assets?.length) {
        return;
      }

      const asset = toDocumentAsset(pickerResult.assets[0], documentType);

      setDocuments((prev) => ({
        ...prev,
        [documentType]: asset,
      }));

      if (documentType === 'front' || documentType === 'back') {
        await processOcr(documentType, asset);
      }
    },
    [ensurePermission, processOcr],
  );

  const presentPickerOptions = useCallback(
    (documentType: DocumentType) => {
      Alert.alert(
        'Upload document',
        'Choose how you would like to add this photo.',
        [
          {
            text: 'Take Photo',
            onPress: () => {
              void handleImageSelection(documentType, 'camera');
            },
          },
          {
            text: 'Choose from Library',
            onPress: () => {
              void handleImageSelection(documentType, 'library');
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [handleImageSelection],
  );

  const handleNext = useCallback(() => {
    if (!documents.front || !documents.back || !documents.selfie) {
      Alert.alert('Missing documents', 'Please provide all three required photos to continue.');
      return;
    }

    router.push({
      pathname: '/(app)/kyc-details',
      params: {
        frontUri: documents.front.uri,
        frontType: documents.front.type,
        frontName: documents.front.name,
        backUri: documents.back.uri,
        backType: documents.back.type,
        backName: documents.back.name,
        selfieUri: documents.selfie.uri,
        selfieType: documents.selfie.type,
        selfieName: documents.selfie.name,
        initialFullName: detectedFields.fullName ?? '',
        initialIdentificationCode: detectedFields.identificationCode ?? '',
        initialBirthday: detectedFields.birthday ?? '',
        initialExpirationDate: detectedFields.expirationDate ?? '',
        initialPermanentAddress: detectedFields.permanentAddress ?? '',
        initialTypeOfIdentification: detectedFields.typeOfIdentification ?? '',
      },
    });
  }, [detectedFields, documents, router]);

  const autoFilledSummary = useMemo(() => {
    const entries: Array<{ label: string; value?: string }> = [
      { label: 'Full name', value: detectedFields.fullName },
      { label: 'ID number', value: detectedFields.identificationCode },
      { label: 'Birthday', value: detectedFields.birthday },
      { label: 'Expiration date', value: detectedFields.expirationDate },
      { label: 'Address', value: detectedFields.permanentAddress },
      { label: 'ID type', value: detectedFields.typeOfIdentification },
    ];

    const hasData = entries.some((entry) => entry.value && entry.value.length > 0);

    if (!hasData) {
      return null;
    }

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Auto-filled details</Text>
        <Text style={styles.summarySubtitle}>
          We used OCR to pre-fill these fields. You can review and edit them on the next step.
        </Text>

        <View style={styles.summaryList}>
          {entries.map((entry) => (
            <View key={entry.label} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{entry.label}</Text>
              <Text style={styles.summaryValue}>
                {entry.value && entry.value.length > 0 ? entry.value : 'Not detected'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }, [detectedFields]);

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>KYC Verification</Text>
          <Text style={styles.subtitle}>
            Upload the required documents. You can take photos with your camera or choose them from your gallery.
          </Text>
        </View>

        <View style={styles.cardList}>
          {(Object.keys(documentCopy) as DocumentType[]).map((documentType) => (
            <DocumentCard
              key={documentType}
              type={documentType}
              asset={documents[documentType]}
              isProcessing={
                documentType !== 'selfie' && ocrState[documentType as 'front' | 'back'].isProcessing
              }
              error={documentType !== 'selfie' ? ocrState[documentType as 'front' | 'back'].error : null}
              onPress={() => presentPickerOptions(documentType)}
            />
          ))}
        </View>

        {autoFilledSummary}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => router.back()}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, !isNextEnabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={!isNextEnabled || isRequestingPermission}
        >
          <Text style={[styles.buttonText, styles.primaryText]}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 20,
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
    color: '#5f5f5f',
    lineHeight: 20,
  },
  cardList: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    padding: 16,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eeeeee',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6c6c6c',
  },
  previewWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    height: 180,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewPlaceholderText: {
    fontSize: 13,
    color: '#8a8a8a',
  },
  cardFooter: {
    minHeight: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#5f5f5f',
  },
  errorText: {
    color: '#d64545',
  },
  successText: {
    color: '#1c8c4d',
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
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececec',
    backgroundColor: '#fdfdfd',
    padding: 16,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#6c6c6c',
    lineHeight: 18,
  },
  summaryList: {
    gap: 10,
  },
  summaryItem: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#909090',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
});
