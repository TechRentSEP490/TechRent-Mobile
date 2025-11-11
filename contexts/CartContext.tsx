import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ProductDetail } from '@/constants/products';

export type CartItem = {
  product: ProductDetail;
  quantity: number;
};

type CartContextValue = {
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

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem: CartContextValue['addItem'] = (product, quantity, options) => {
    setItems((current) => {
      const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
      const replace = options?.replace ?? false;
      const existingIndex = current.findIndex((item) => item.product.id === product.id);
      const stockLimit = resolveAvailableStock(product);

      if (stockLimit === 0) {
        return current;
      }

      if (replace) {
        const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

        if (clampedQuantity <= 0) {
          return current.filter((item) => item.product.id !== product.id);
        }

        const nextItems = existingIndex >= 0 ? [...current] : [...current, { product, quantity: clampedQuantity }];
        if (existingIndex >= 0) {
          nextItems[existingIndex] = { product, quantity: clampedQuantity };
        }
        return nextItems;
      }

      if (existingIndex >= 0) {
        const nextItems = [...current];
        const existing = nextItems[existingIndex];
        const desiredQuantity = existing.quantity + normalizedQuantity;
        const clampedQuantity = Math.min(desiredQuantity, stockLimit);

        nextItems[existingIndex] = {
          product: existing.product,
          quantity: clampedQuantity,
        };
        return nextItems;
      }

      const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

      if (clampedQuantity <= 0) {
        return current;
      }

      return [...current, { product, quantity: clampedQuantity }];
    });
  };

  const updateQuantity: CartContextValue['updateQuantity'] = (productId, quantity) => {
    setItems((current) => {
      const normalizedQuantity = Math.floor(Number(quantity));
      const nextItems = [...current];
      const index = nextItems.findIndex((item) => item.product.id === productId);

      if (index === -1) {
        return current;
      }

      const targetItem = nextItems[index];
      const stockLimit = resolveAvailableStock(targetItem.product);

      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        nextItems.splice(index, 1);
        return nextItems;
      }

      const clampedQuantity = Math.min(normalizedQuantity, stockLimit);

      if (clampedQuantity <= 0) {
        nextItems.splice(index, 1);
        return nextItems;
      }

      if (clampedQuantity === targetItem.quantity) {
        return current;
      }

      nextItems[index] = {
        product: targetItem.product,
        quantity: clampedQuantity,
      };

      return nextItems;
    });
  };

  const removeItem: CartContextValue['removeItem'] = (productId) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  };

  const clear: CartContextValue['clear'] = () => {
    setItems([]);
  };

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
