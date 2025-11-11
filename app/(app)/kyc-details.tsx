import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
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
import { uploadKycDocuments } from '@/services/kyc';

type DocumentType = 'front' | 'back' | 'selfie';

type DocumentAsset = {
  uri: string;
  type: string;
  name: string;
};

type KycDetailsParams = {
  frontUri?: string | string[];
  frontType?: string | string[];
  frontName?: string | string[];
  backUri?: string | string[];
  backType?: string | string[];
  backName?: string | string[];
  selfieUri?: string | string[];
  selfieType?: string | string[];
  selfieName?: string | string[];
  initialFullName?: string | string[];
  initialIdentificationCode?: string | string[];
  initialBirthday?: string | string[];
  initialExpirationDate?: string | string[];
  initialPermanentAddress?: string | string[];
  initialTypeOfIdentification?: string | string[];
};

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const decodeParam = (value: string) => {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildDocumentAsset = (uri: string, type: string, name: string): DocumentAsset | null => {
  if (!uri) {
    return null;
  }

  return {
    uri,
    type: type.length > 0 ? type : 'image/jpeg',
    name: name.length > 0 ? name : 'document.jpg',
  };
};

const documentTitles: Record<DocumentType, string> = {
  front: 'Front side',
  back: 'Back side',
  selfie: 'Selfie',
};

const idTypeOptions = ['CCCD', 'CMND', 'PASSPORT'];

export default function KycDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<KycDetailsParams>();
  const { ensureSession } = useAuth();

  const documentAssets = useMemo(() => {
    const frontUri = decodeParam(getParamValue(params.frontUri));
    const frontType = decodeParam(getParamValue(params.frontType));
    const frontName = decodeParam(getParamValue(params.frontName));
    const backUri = decodeParam(getParamValue(params.backUri));
    const backType = decodeParam(getParamValue(params.backType));
    const backName = decodeParam(getParamValue(params.backName));
    const selfieUri = decodeParam(getParamValue(params.selfieUri));
    const selfieType = decodeParam(getParamValue(params.selfieType));
    const selfieName = decodeParam(getParamValue(params.selfieName));

    return {
      front: buildDocumentAsset(frontUri, frontType, frontName),
      back: buildDocumentAsset(backUri, backType, backName),
      selfie: buildDocumentAsset(selfieUri, selfieType, selfieName),
    } satisfies Record<DocumentType, DocumentAsset | null>;
  }, [params.backName, params.backType, params.backUri, params.frontName, params.frontType, params.frontUri, params.selfieName, params.selfieType, params.selfieUri]);

  const [fullName, setFullName] = useState(() => decodeParam(getParamValue(params.initialFullName)));
  const [identificationCode, setIdentificationCode] = useState(() =>
    decodeParam(getParamValue(params.initialIdentificationCode)),
  );
  const [birthday, setBirthday] = useState(() => decodeParam(getParamValue(params.initialBirthday)));
  const [expirationDate, setExpirationDate] = useState(() =>
    decodeParam(getParamValue(params.initialExpirationDate)),
  );
  const [permanentAddress, setPermanentAddress] = useState(() =>
    decodeParam(getParamValue(params.initialPermanentAddress)),
  );
  const [typeOfIdentification, setTypeOfIdentification] = useState(() => {
    const initial = decodeParam(getParamValue(params.initialTypeOfIdentification));
    return initial.length > 0 ? initial : 'CCCD';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFormValid =
    fullName.trim().length > 0 &&
    identificationCode.trim().length > 0 &&
    birthday.trim().length > 0 &&
    expirationDate.trim().length > 0 &&
    permanentAddress.trim().length > 0 &&
    typeOfIdentification.trim().length > 0;

  const handleSubmit = async () => {
    if (!documentAssets.front || !documentAssets.back || !documentAssets.selfie) {
      Alert.alert('Missing documents', 'We could not find all required document photos. Please go back and try again.');
      return;
    }

    if (!isFormValid) {
      setErrorMessage('Please complete all required fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await ensureSession();

      if (!session) {
        Alert.alert('Authentication required', 'Please sign in again to submit your documents.');
        return;
      }

      const response = await uploadKycDocuments({
        accessToken: session.accessToken,
        tokenType: session.tokenType,
        front: documentAssets.front,
        back: documentAssets.back,
        selfie: documentAssets.selfie,
        fullName: fullName.trim(),
        identificationCode: identificationCode.trim(),
        typeOfIdentification: typeOfIdentification.trim(),
        birthday: birthday.trim(),
        expirationDate: expirationDate.trim(),
        permanentAddress: permanentAddress.trim(),
      });

      Alert.alert(
        'KYC submitted',
        response?.message || 'Your documents were uploaded successfully. We will notify you once the review is complete.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(app)/(tabs)/profile');
            },
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload KYC documents.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentPreview = (type: DocumentType) => {
    const asset = documentAssets[type];

    return (
      <View key={type} style={styles.previewItem}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.previewImage} contentFit="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="image-outline" size={26} color="#a0a0a0" />
          </View>
        )}
        <Text style={styles.previewLabel}>{documentTitles[type]}</Text>
      </View>
    );
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
            <Text style={styles.title}>Review & Submit</Text>
            <Text style={styles.subtitle}>
              Confirm the details extracted from your documents and update anything that needs to be corrected.
            </Text>
          </View>

          <View style={styles.previewRow}>{(['front', 'back', 'selfie'] as DocumentType[]).map(renderDocumentPreview)}</View>

          {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#888888"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Identification number</Text>
            <TextInput
              style={styles.input}
              placeholder="ID number"
              placeholderTextColor="#888888"
              value={identificationCode}
              onChangeText={setIdentificationCode}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Type of identification</Text>
            <View style={styles.segmentContainer}>
              {idTypeOptions.map((option) => {
                const isActive = option === typeOfIdentification;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                    onPress={() => setTypeOfIdentification(option)}
                  >
                    <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inlineFields}>
            <View style={styles.inlineField}>
              <Text style={styles.label}>Birthday</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#888888"
                value={birthday}
                onChangeText={setBirthday}
              />
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.label}>Expiration date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#888888"
                value={expirationDate}
                onChangeText={setExpirationDate}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Permanent address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Permanent address"
              placeholderTextColor="#888888"
              value={permanentAddress}
              onChangeText={setPermanentAddress}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, (!isFormValid || isSubmitting) && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={[styles.buttonText, styles.primaryText]}>Submit documents</Text>
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
    lineHeight: 20,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  previewItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  previewImage: {
    width: '100%',
    height: 120,
  },
  previewPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
    color: '#5f5f5f',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldGroup: {
    gap: 10,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 16,
  },
  inlineField: {
    flex: 1,
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
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  segmentLabel: {
    fontSize: 13,
    color: '#5f5f5f',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#ffffff',
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
    opacity: 0.6,
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
  errorMessage: {
    color: '#d64545',
    fontSize: 13,
  },
});
