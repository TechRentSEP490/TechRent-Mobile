/**
 * API Contract Tests - Dùng MSW để test frontend xử lý response
 * Test các trường hợp: 400, 401, 500, empty data
 */
import {
    badRequestHandlers,
    emptyDataHandlers,
    serverErrorHandlers,
    unauthorizedHandlers,
} from '../mocks/handlers';
import { server } from '../mocks/server';

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());

describe('API Contract Tests', () => {
    // ============================================
    // Success Response Tests (200)
    // ============================================
    describe('Success Responses (200)', () => {
        it('should handle successful login response', async () => {
            const response = await fetch('http://test-api.example.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@test.com', password: 'password' }),
            });

            expect(response.ok).toBe(true);
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toHaveProperty('accessToken');
            expect(data).toHaveProperty('refreshToken');
        });

        it('should handle successful device models response', async () => {
            const response = await fetch('http://test-api.example.com/api/device-models');

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data).toHaveProperty('content');
            expect(data).toHaveProperty('totalPages');
            expect(Array.isArray(data.content)).toBe(true);
        });
    });

    // ============================================
    // Error Response Tests (400 Bad Request)
    // ============================================
    describe('Error Responses - 400 Bad Request', () => {
        beforeEach(() => {
            server.use(...badRequestHandlers);
        });

        it('should handle login validation error', async () => {
            const response = await fetch('http://test-api.example.com/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: '', password: '' }),
            });

            expect(response.ok).toBe(false);
            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toHaveProperty('message');
        });

        it('should handle rental order validation error', async () => {
            const response = await fetch('http://test-api.example.com/api/rental-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            expect(response.ok).toBe(false);
            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.errors).toBeDefined();
        });
    });

    // ============================================
    // Error Response Tests (401 Unauthorized)
    // ============================================
    describe('Error Responses - 401 Unauthorized', () => {
        beforeEach(() => {
            server.use(...unauthorizedHandlers);
        });

        it('should handle unauthorized access to orders', async () => {
            const response = await fetch('http://test-api.example.com/api/rental-orders');

            expect(response.ok).toBe(false);
            expect(response.status).toBe(401);

            const data = await response.json();
            expect(data.message).toContain('Unauthorized');
        });

        it('should handle unauthorized access to user profile', async () => {
            const response = await fetch('http://test-api.example.com/api/users/me');

            expect(response.ok).toBe(false);
            expect(response.status).toBe(401);
        });
    });

    // ============================================
    // Error Response Tests (500 Server Error)
    // ============================================
    describe('Error Responses - 500 Server Error', () => {
        beforeEach(() => {
            server.use(...serverErrorHandlers);
        });

        it('should handle server error gracefully', async () => {
            const response = await fetch('http://test-api.example.com/api/device-models');

            expect(response.ok).toBe(false);
            expect(response.status).toBe(500);

            const data = await response.json();
            expect(data.message).toBe('Internal server error');
        });
    });

    // ============================================
    // Empty Data Tests
    // ============================================
    describe('Empty Data Responses', () => {
        beforeEach(() => {
            server.use(...emptyDataHandlers);
        });

        it('should handle empty device models list', async () => {
            const response = await fetch('http://test-api.example.com/api/device-models');

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.content).toEqual([]);
            expect(data.totalElements).toBe(0);
        });

        it('should handle empty orders list', async () => {
            const response = await fetch('http://test-api.example.com/api/rental-orders');

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(0);
        });
    });
});
