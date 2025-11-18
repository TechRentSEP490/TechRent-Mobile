import { Ionicons } from '@expo/vector-icons';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import styles from '@/style/product-details.styles';

export type RentDeviceModalProps = {
  visible: boolean;
  name: string;
  model: string;
  brand: string;
  price: string;
  quantity: number;
  maxQuantity: number;
  stockLabel: string;
  shouldShowTotalCost: boolean;
  totalCostLabel: string;
  rentMode: 'rent' | 'cart' | null;
  isPrimaryDisabled: boolean;
  onClose: () => void;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  onPrimaryAction: () => void;
};

export default function RentDeviceModal({
  visible,
  name,
  model,
  brand,
  price,
  quantity,
  maxQuantity,
  stockLabel,
  shouldShowTotalCost,
  totalCostLabel,
  rentMode,
  isPrimaryDisabled,
  onClose,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onPrimaryAction,
}: RentDeviceModalProps) {
  const mode = rentMode ?? 'rent';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.rentModalContent}>
          <View style={styles.rentModalHeader}>
            <Text style={styles.rentModalTitle}>Rent Device</Text>
            <TouchableOpacity style={styles.rentModalClose} onPress={onClose}>
              <Ionicons name="close" size={20} color="#111111" />
            </TouchableOpacity>
          </View>

          <View style={styles.rentSummary}>
            <View style={styles.rentSummaryThumb}>
              <Ionicons name="phone-portrait-outline" size={24} color="#6f6f6f" />
            </View>
            <View style={styles.rentSummaryDetails}>
              <Text style={styles.rentSummaryName}>{name}</Text>
              <Text style={styles.rentSummaryMeta}>{`${model} • ${brand}`}</Text>
              <Text style={styles.rentSummaryPrice}>{price}</Text>
            </View>
          </View>

          <View style={styles.rentFieldGroup}>
            <Text style={styles.rentFieldLabel}>Quantity</Text>
            <View style={styles.rentQuantityControl}>
              <TouchableOpacity
                style={[styles.rentQuantityButton, quantity === 1 && styles.rentQuantityButtonDisabled]}
                onPress={onDecreaseQuantity}
                disabled={quantity === 1}
              >
                <Ionicons name="remove" size={18} color="#111111" />
              </TouchableOpacity>
              <Text style={styles.rentQuantityValue}>{quantity}</Text>
              <TouchableOpacity
                style={[
                  styles.rentQuantityButton,
                  quantity === maxQuantity && styles.rentQuantityButtonDisabled,
                ]}
                onPress={onIncreaseQuantity}
                disabled={quantity === maxQuantity}
              >
                <Ionicons name="add" size={18} color="#111111" />
              </TouchableOpacity>
            </View>
            <Text style={styles.rentStockLabel}>{stockLabel}</Text>
          </View>

          <View style={styles.rentInfoBanner}>
            <Ionicons name="calendar-outline" size={18} color="#1a73e8" />
            <Text style={styles.rentInfoText}>
              Select your rental dates and shipping address from the cart before checkout.
            </Text>
          </View>

          {shouldShowTotalCost && (
            <View style={styles.rentTotalRow}>
              <Text style={styles.rentTotalLabel}>Total Cost</Text>
              <Text style={styles.rentTotalValue}>{totalCostLabel}</Text>
            </View>
          )}

          <View style={styles.rentFooter}>
            <TouchableOpacity
              style={[
                styles.rentPrimaryAction,
                mode === 'cart' && styles.cartModeButton,
                isPrimaryDisabled && styles.disabledButton,
              ]}
              disabled={isPrimaryDisabled}
              onPress={onPrimaryAction}
            >
              <Text
                style={[
                  styles.rentPrimaryActionText,
                  mode === 'cart' && styles.cartModeButtonText,
                  isPrimaryDisabled && styles.disabledButtonText,
                ]}
              >
                {mode === 'cart' ? 'Add to Cart' : 'Rent Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
