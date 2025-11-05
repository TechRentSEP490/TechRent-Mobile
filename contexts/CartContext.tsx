import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { ProductDetail } from '@/constants/products';
import { useAuth } from './AuthContext';

type CartItem = {
  productId: string;
  product: ProductDetail;
  quantity: number;
  addedAt: number;
};

type CartContextValue = {
  items: CartItem[];
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  isEmpty: boolean;
  addItem: (product: ProductDetail, quantity?: number) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  setRentalStartDate: (isoDate: string | null) => void;
  setRentalEndDate: (isoDate: string | null) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const clampQuantity = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.floor(value);
};

export function CartProvider({ children }: PropsWithChildren) {
  const { isSignedIn } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [rentalStartDate, setRentalStartDateState] = useState<string | null>(null);
  const [rentalEndDate, setRentalEndDateState] = useState<string | null>(null);

  const clearCart = useCallback(() => {
    setItems([]);
    setRentalStartDateState(null);
    setRentalEndDateState(null);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      clearCart();
    }
  }, [clearCart, isSignedIn]);

  const addItem = useCallback((product: ProductDetail, quantity = 1) => {
    const normalizedQuantity = clampQuantity(quantity);

    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.productId === product.id);

      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          product,
          quantity: existing.quantity + normalizedQuantity,
        };
        return next;
      }

      return [
        ...current,
        {
          productId: product.id,
          product,
          quantity: normalizedQuantity,
          addedAt: Date.now(),
        },
      ];
    });
  }, []);

  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => {
      const normalized = clampQuantity(quantity);
      return current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: normalized,
            }
          : item,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const setRentalStartDate = useCallback((isoDate: string | null) => {
    setRentalStartDateState(isoDate);
  }, []);

  const setRentalEndDate = useCallback((isoDate: string | null) => {
    setRentalEndDateState(isoDate);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      rentalStartDate,
      rentalEndDate,
      isEmpty: items.length === 0,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
      setRentalStartDate,
      setRentalEndDate,
    }),
    [addItem, clearCart, items, removeItem, rentalEndDate, rentalStartDate, setRentalEndDate, setRentalStartDate, updateItemQuantity],
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
