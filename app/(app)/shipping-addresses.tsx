import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useAuth } from '@/contexts/AuthContext';
import {
  createShippingAddress,
  deleteShippingAddress,
  fetchShippingAddresses,
  type ShippingAddress,
} from '@/services/shipping-addresses';
import styles from '@/style/shipping-addresses.styles';

const normalizeInput = (value: string) => value.trim();

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

export default function ShippingAddressesScreen() {
  const router = useRouter();
  const { session, ensureSession, refreshProfile } = useAuth();

  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resolveSession = useCallback(async () => {
    if (session?.accessToken) {
      return session;
    }

    return ensureSession();
  }, [ensureSession, session]);

  const loadAddresses = useCallback(async () => {
    const activeSession = session?.accessToken ? session : await ensureSession();

    if (!activeSession?.accessToken) {
      throw new Error('Please sign in to view your shipping addresses.');
    }

    const results = await fetchShippingAddresses({
      accessToken: activeSession.accessToken,
      tokenType: activeSession.tokenType,
    });

    return results;
  }, [ensureSession, session]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      setLoadError(null);

      loadAddresses()
        .then((results) => {
          if (!isActive) {
            return;
          }

          setAddresses(results);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load shipping addresses. Please try again later.';
          setLoadError(message);
          setAddresses([]);
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [loadAddresses]),
  );

  const sortedAddresses = useMemo(() => {
    return [...addresses].sort((a, b) => {
      const aDate = a.updatedAt ?? a.createdAt ?? '';
      const bDate = b.updatedAt ?? b.createdAt ?? '';
      if (!aDate && !bDate) {
        return a.shippingAddressId - b.shippingAddressId;
      }
      if (!aDate) {
        return 1;
      }
      if (!bDate) {
        return -1;
      }
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [addresses]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const results = await loadAddresses();
      setAddresses(results);
      setLoadError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to refresh shipping addresses. Please try again later.';
      setLoadError(message);
      Toast.show({ type: 'error', text1: 'Unable to refresh addresses', text2: message });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAddresses]);

  const handleAddAddress = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const normalized = normalizeInput(newAddress);

    if (normalized.length === 0) {
      setFieldError('Address is required.');
      return;
    }

    if (normalized.length < 3) {
      setFieldError('Enter a valid shipping address.');
      return;
    }

    setIsSubmitting(true);
    setFieldError(null);
    setActionError(null);

    try {
      const activeSession = await resolveSession();

      if (!activeSession?.accessToken) {
        throw new Error('Please sign in again to add a shipping address.');
      }

      const created = await createShippingAddress(
        { address: normalized },
        { accessToken: activeSession.accessToken, tokenType: activeSession.tokenType },
      );

      setAddresses((prev) => [created, ...prev]);
      setNewAddress('');
      Toast.show({
        type: 'success',
        text1: 'Address added',
        text2: 'Your shipping address is ready to use at checkout.',
      });
      setActionError(null);
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn('Failed to refresh profile after adding address', refreshError);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We were unable to add your shipping address. Please try again later.';
      setActionError(message);
      Toast.show({ type: 'error', text1: 'Add address failed', text2: message });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, newAddress, resolveSession, refreshProfile]);

  const confirmDeleteAddress = useCallback(
    (address: ShippingAddress) => {
      Alert.alert(
        'Remove this address?',
        'Deleting this address will remove it from future checkout options.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setPendingDeleteId(address.shippingAddressId);
              setActionError(null);

              void (async () => {
                try {
                  const activeSession = await resolveSession();

                  if (!activeSession?.accessToken) {
                    throw new Error('Please sign in again to remove this address.');
                  }

                  await deleteShippingAddress(address.shippingAddressId, {
                    accessToken: activeSession.accessToken,
                    tokenType: activeSession.tokenType,
                  });

                  setAddresses((prev) =>
                    prev.filter((item) => item.shippingAddressId !== address.shippingAddressId),
                  );
                  Toast.show({
                    type: 'success',
                    text1: 'Address removed',
                    text2: 'The shipping address has been deleted.',
                  });
                  try {
                    await refreshProfile();
                  } catch (refreshError) {
                    console.warn('Failed to refresh profile after deleting address', refreshError);
                  }
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : 'We were unable to delete the shipping address. Please try again later.';
                  setActionError(message);
                  Toast.show({ type: 'error', text1: 'Delete address failed', text2: message });
                } finally {
                  setPendingDeleteId(null);
                }
              })();
            },
          },
        ],
        { cancelable: true },
      );
    },
    [refreshProfile, resolveSession],
  );

  const renderAddressCard = useCallback(
    (address: ShippingAddress) => {
      const timestamp = formatTimestamp(address.updatedAt ?? address.createdAt);
      const isDeleting = pendingDeleteId === address.shippingAddressId;

      return (
        <View key={address.shippingAddressId} style={styles.addressCard}>
          <View style={styles.addressCardHeader}>
            <Ionicons name="location-outline" size={20} color="#111111" />
            <Text style={styles.addressCardTitle}>Shipping address #{address.shippingAddressId}</Text>
          </View>
          <Text style={styles.addressCardText}>{address.address}</Text>
          {timestamp ? <Text style={styles.addressCardMeta}>Updated {timestamp}</Text> : null}
          <TouchableOpacity
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={() => confirmDeleteAddress(address)}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Delete shipping address"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [confirmDeleteAddress, pendingDeleteId],
  );

  const hasAddresses = sortedAddresses.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shipping addresses</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <Text style={styles.subtitle}>
          Save the places you want us to deliver your rentals. You can reuse these addresses during checkout.
        </Text>

        {loadError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{loadError}</Text>
          </View>
        ) : null}

        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{actionError}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add a new address</Text>
          <Text style={styles.formDescription}>
            Provide a detailed location so our team can reach you quickly when your devices are ready.
          </Text>
          <TextInput
            value={newAddress}
            onChangeText={(text) => {
              setNewAddress(text);
              if (fieldError) {
                setFieldError(null);
              }
            }}
            placeholder="e.g. 123 Nguyen Hue, District 1, Ho Chi Minh City"
            style={[styles.input, fieldError && styles.inputError]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoCorrect
            autoCapitalize="sentences"
          />
          {fieldError ? <Text style={styles.fieldErrorText}>{fieldError}</Text> : null}
          <TouchableOpacity
            style={[styles.addButton, isSubmitting && styles.addButtonDisabled]}
            onPress={handleAddAddress}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Add shipping address"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.addButtonText}>Save address</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved addresses</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => void handleRefresh()}
            disabled={isRefreshing || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Refresh saved addresses"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#111111" style={styles.refreshIcon} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#111111" />
            <Text style={styles.loadingStateText}>Loading your addresses…</Text>
          </View>
        ) : hasAddresses ? (
          <View style={styles.addressList}>{sortedAddresses.map(renderAddressCard)}</View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={48} color="#6f6f6f" />
            <Text style={styles.emptyStateTitle}>No addresses yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Add your first shipping address above so we know where to deliver your rentals.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


