/**
 * Unit Tests for stores/cart-store.ts
 * Test Zustand store: addItem, updateQuantity, removeItem, clear
 */
import type { ProductDetail } from '@/constants/products';
import { useCartStore } from '@/stores/cart-store';

// Mock product for testing
const createMockProduct = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
    id: 'product-1',
    name: 'Test Product',
    description: 'Test description',
    price: 100000,
    rentalPricePerDay: 10000,
    rentalPricePerWeek: 60000,
    rentalPricePerMonth: 200000,
    stock: 10,
    category: 'Laptop',
    image: '/test.jpg',
    specs: {},
    ...overrides,
});

describe('cart-store', () => {
    // Reset store before each test
    beforeEach(() => {
        useCartStore.getState().clear();
    });

    // ============================================
    // addItem
    // ============================================
    describe('addItem', () => {
        it('should add a new item to empty cart', () => {
            const product = createMockProduct();

            useCartStore.getState().addItem(product, 2);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].product.id).toBe('product-1');
            expect(items[0].quantity).toBe(2);
        });

        it('should increment quantity for existing item', () => {
            const product = createMockProduct();

            useCartStore.getState().addItem(product, 2);
            useCartStore.getState().addItem(product, 3);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].quantity).toBe(5);
        });

        it('should clamp quantity to stock limit', () => {
            const product = createMockProduct({ stock: 5 });

            useCartStore.getState().addItem(product, 10);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(5);
        });

        it('should not add item if stock is 0', () => {
            const product = createMockProduct({ stock: 0 });

            useCartStore.getState().addItem(product, 1);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(0);
        });

        it('should replace quantity when replace option is true', () => {
            const product = createMockProduct();

            useCartStore.getState().addItem(product, 5);
            useCartStore.getState().addItem(product, 2, { replace: true });

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(2);
        });

        it('should normalize invalid quantity to 1', () => {
            const product = createMockProduct();

            useCartStore.getState().addItem(product, -5);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(1);
        });

        it('should handle undefined stock as infinite', () => {
            const product = createMockProduct({ stock: undefined });

            useCartStore.getState().addItem(product, 100);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(100);
        });
    });

    // ============================================
    // updateQuantity
    // ============================================
    describe('updateQuantity', () => {
        it('should update quantity of existing item', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 2);

            useCartStore.getState().updateQuantity('product-1', 5);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(5);
        });

        it('should remove item when quantity is 0', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 2);

            useCartStore.getState().updateQuantity('product-1', 0);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(0);
        });

        it('should remove item when quantity is negative', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 2);

            useCartStore.getState().updateQuantity('product-1', -1);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(0);
        });

        it('should clamp to stock limit', () => {
            const product = createMockProduct({ stock: 5 });
            useCartStore.getState().addItem(product, 2);

            useCartStore.getState().updateQuantity('product-1', 100);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(5);
        });

        it('should not change state if product not found', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 2);

            useCartStore.getState().updateQuantity('non-existent', 5);

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].quantity).toBe(2);
        });

        it('should not update if quantity is the same', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 5);

            const stateBefore = useCartStore.getState().items;
            useCartStore.getState().updateQuantity('product-1', 5);
            const stateAfter = useCartStore.getState().items;

            expect(stateBefore).toBe(stateAfter);
        });
    });

    // ============================================
    // removeItem
    // ============================================
    describe('removeItem', () => {
        it('should remove item from cart', () => {
            const product1 = createMockProduct({ id: 'product-1' });
            const product2 = createMockProduct({ id: 'product-2' });

            useCartStore.getState().addItem(product1, 1);
            useCartStore.getState().addItem(product2, 1);

            useCartStore.getState().removeItem('product-1');

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
            expect(items[0].product.id).toBe('product-2');
        });

        it('should handle removing non-existent item gracefully', () => {
            const product = createMockProduct();
            useCartStore.getState().addItem(product, 1);

            useCartStore.getState().removeItem('non-existent');

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(1);
        });
    });

    // ============================================
    // clear
    // ============================================
    describe('clear', () => {
        it('should remove all items from cart', () => {
            const product1 = createMockProduct({ id: 'product-1' });
            const product2 = createMockProduct({ id: 'product-2' });

            useCartStore.getState().addItem(product1, 2);
            useCartStore.getState().addItem(product2, 3);

            useCartStore.getState().clear();

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(0);
        });

        it('should work on empty cart', () => {
            useCartStore.getState().clear();

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(0);
        });
    });

    // ============================================
    // Edge Cases
    // ============================================
    describe('edge cases', () => {
        it('should handle multiple products correctly', () => {
            const products = [
                createMockProduct({ id: 'p1', name: 'Product 1' }),
                createMockProduct({ id: 'p2', name: 'Product 2' }),
                createMockProduct({ id: 'p3', name: 'Product 3' }),
            ];

            products.forEach((p, i) => {
                useCartStore.getState().addItem(p, i + 1);
            });

            const items = useCartStore.getState().items;
            expect(items).toHaveLength(3);
            expect(items[0].quantity).toBe(1);
            expect(items[1].quantity).toBe(2);
            expect(items[2].quantity).toBe(3);
        });

        it('should handle decimal quantities by flooring', () => {
            const product = createMockProduct();

            useCartStore.getState().addItem(product, 2.7);

            const items = useCartStore.getState().items;
            expect(items[0].quantity).toBe(2);
        });
    });
});
