/**
 * Utility for managing confirmed return orders in SecureStore
 * Similar to localStorage usage in web version
 */

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'confirmedReturnOrders';

/**
 * Get all confirmed return order IDs from SecureStore
 */
export async function getConfirmedReturnOrders(): Promise<Set<number>> {
    try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as number[];
            return new Set(parsed);
        }
    } catch (error) {
        console.error('[ConfirmedReturns] Failed to load from SecureStore:', error);
    }
    return new Set();
}

/**
 * Save a confirmed return order ID to SecureStore
 */
export async function saveConfirmedReturnOrder(orderId: number): Promise<void> {
    try {
        const existing = await getConfirmedReturnOrders();
        existing.add(orderId);
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(Array.from(existing)));
        console.log('[ConfirmedReturns] Saved order as confirmed:', orderId);
    } catch (error) {
        console.error('[ConfirmedReturns] Failed to save to SecureStore:', error);
        throw error;
    }
}

/**
 * Check if an order has been confirmed for return
 */
export async function isOrderReturnConfirmed(orderId: number): Promise<boolean> {
    const confirmed = await getConfirmedReturnOrders();
    return confirmed.has(orderId);
}

/**
 * Remove an order from confirmed returns (e.g., after return is completed)
 */
export async function removeConfirmedReturnOrder(orderId: number): Promise<void> {
    try {
        const existing = await getConfirmedReturnOrders();
        existing.delete(orderId);
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(Array.from(existing)));
        console.log('[ConfirmedReturns] Removed order from confirmed:', orderId);
    } catch (error) {
        console.error('[ConfirmedReturns] Failed to remove from SecureStore:', error);
    }
}

/**
 * Clear all confirmed return orders
 */
export async function clearConfirmedReturnOrders(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        console.log('[ConfirmedReturns] Cleared all confirmed orders');
    } catch (error) {
        console.error('[ConfirmedReturns] Failed to clear SecureStore:', error);
    }
}

