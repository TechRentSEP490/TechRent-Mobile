import { create } from 'zustand';
import type { ReactNode } from 'react';

import type { ProductDetail } from '@/constants/products';

export type CartItem = {
  product: ProductDetail;
  quantity: number;
};

type CartStore = {
  items: CartItem[];
  addItem: (product: ProductDetail, quantity: number, options?: { replace?: boolean }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const resolveAvailableStock = (product: ProductDetail) => {
  if (typeof product.stock === 'number' && Number.isFinite(product.stock)) {
    return Math.max(0, Math.floor(product.stock));
  }

  return Number.POSITIVE_INFINITY;
};

export const useCartStore = create<CartStore>()((set) => ({
  items: [],
  addItem: (product, quantity, options) =>
    set((state) => {
      const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
      const replace = options?.replace ?? false;
      const existingIndex = state.items.findIndex((item) => item.product.id === product.id);
      const stockLimit = resolveAvailableStock(product);

      if (stockLimit === 0) {
        return state;
      }

      if (replace) {
        const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

        if (clampedQuantity <= 0) {
          return { items: state.items.filter((item) => item.product.id !== product.id) };
        }

        if (existingIndex >= 0) {
          const nextItems = [...state.items];
          nextItems[existingIndex] = { product, quantity: clampedQuantity };
          return { items: nextItems };
        }

        return { items: [...state.items, { product, quantity: clampedQuantity }] };
      }

      if (existingIndex >= 0) {
        const nextItems = [...state.items];
        const existing = nextItems[existingIndex];
        const desiredQuantity = existing.quantity + normalizedQuantity;
        const clampedQuantity = Math.min(desiredQuantity, stockLimit);

        nextItems[existingIndex] = {
          product: existing.product,
          quantity: clampedQuantity,
        };

        return { items: nextItems };
      }

      const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

      if (clampedQuantity <= 0) {
        return state;
      }

      return { items: [...state.items, { product, quantity: clampedQuantity }] };
    }),
  updateQuantity: (productId, quantity) =>
    set((state) => {
      const normalizedQuantity = Math.floor(Number(quantity));
      const nextItems = [...state.items];
      const index = nextItems.findIndex((item) => item.product.id === productId);

      if (index === -1) {
        return state;
      }

      const targetItem = nextItems[index];
      const stockLimit = resolveAvailableStock(targetItem.product);

      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        nextItems.splice(index, 1);
        return { items: nextItems };
      }

      const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

      if (clampedQuantity <= 0) {
        nextItems.splice(index, 1);
        return { items: nextItems };
      }

      if (clampedQuantity === targetItem.quantity) {
        return state;
      }

      nextItems[index] = {
        product: targetItem.product,
        quantity: clampedQuantity,
      };

      return { items: nextItems };
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    })),
  clear: () => set({ items: [] }),
}));

export function CartProvider({ children }: { children: ReactNode }) {
  return children;
}

export const useCart = useCartStore;
