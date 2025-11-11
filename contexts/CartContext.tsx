import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ProductDetail } from '@/constants/products';

export type CartItem = {
  product: ProductDetail;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: ProductDetail, quantity: number, options?: { replace?: boolean }) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem: CartContextValue['addItem'] = (product, quantity, options) => {
    setItems((current) => {
      const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
      const replace = options?.replace ?? false;
      const existingIndex = current.findIndex((item) => item.product.id === product.id);

      if (replace) {
        const nextItems = existingIndex >= 0 ? [...current] : [...current, { product, quantity: normalizedQuantity }];
        if (existingIndex >= 0) {
          nextItems[existingIndex] = { product, quantity: normalizedQuantity };
        }
        return nextItems;
      }

      if (existingIndex >= 0) {
        const nextItems = [...current];
        const existing = nextItems[existingIndex];
        nextItems[existingIndex] = {
          product: existing.product,
          quantity: existing.quantity + normalizedQuantity,
        };
        return nextItems;
      }

      return [...current, { product, quantity: normalizedQuantity }];
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
