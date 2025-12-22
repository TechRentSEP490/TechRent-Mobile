/**
 * Unit Tests for services/api.ts
 * Test API utility functions: ensureApiUrl, buildApiUrl, fetchWithRetry
 */

// Phải mock trước khi import
const originalEnv = process.env;

describe('api service utilities', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    // ============================================
    // ensureApiUrl
    // ============================================
    describe('ensureApiUrl', () => {
        it('should return API URL when configured', () => {
            process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com/';

            const { ensureApiUrl } = require('@/services/api');
            const result = ensureApiUrl();

            expect(result).toBe('http://api.example.com');
        });

        it('should remove trailing slash from URL', () => {
            process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com/api/';

            const { ensureApiUrl } = require('@/services/api');
            const result = ensureApiUrl();

            expect(result).toBe('http://api.example.com/api');
        });

        it('should throw error when API URL is not configured', () => {
            delete process.env.EXPO_PUBLIC_API_URL;

            jest.resetModules();
            const { ensureApiUrl } = require('@/services/api');

            expect(() => ensureApiUrl()).toThrow('API URL is not configured');
        });
    });

    // ============================================
    // buildApiUrl
    // ============================================
    describe('buildApiUrl', () => {
        beforeEach(() => {
            process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com';
        });

        it('should build URL with single segment', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl('users');

            expect(result).toBe('http://api.example.com/users');
        });

        it('should build URL with multiple segments', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl('api', 'v1', 'users', 123);

            expect(result).toBe('http://api.example.com/api/v1/users/123');
        });

        it('should handle segments with slashes', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl('/api/', '/users/');

            expect(result).toBe('http://api.example.com/api/users');
        });

        it('should handle empty segments', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl('api', '', 'users');

            expect(result).toBe('http://api.example.com/api/users');
        });

        it('should return base URL when no segments provided', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl();

            expect(result).toBe('http://api.example.com');
        });

        it('should handle numeric segments', () => {
            const { buildApiUrl } = require('@/services/api');
            const result = buildApiUrl('orders', 12345);

            expect(result).toBe('http://api.example.com/orders/12345');
        });
    });

    // ============================================
    // fetchWithRetry
    // ============================================
    describe('fetchWithRetry', () => {
        beforeEach(() => {
            process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com';
            (global.fetch as jest.Mock).mockClear();
        });

        it('should return response on successful fetch', async () => {
            const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
            (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

            const { fetchWithRetry } = require('@/services/api');
            const result = await fetchWithRetry('http://api.example.com/test');

            expect(result).toBe(mockResponse);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should retry with HTTPS on HTTP failure', async () => {
            const mockError = new Error('Network error');
            const mockResponse = { ok: true };

            (global.fetch as jest.Mock)
                .mockRejectedValueOnce(mockError)
                .mockResolvedValueOnce(mockResponse);

            const { fetchWithRetry } = require('@/services/api');
            const result = await fetchWithRetry('http://api.example.com/test');

            expect(result).toBe(mockResponse);
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.fetch).toHaveBeenLastCalledWith(
                'https://api.example.com/test',
                undefined
            );
        });

        it('should call onRetry callback when retrying', async () => {
            const mockError = new Error('Network error');
            const mockResponse = { ok: true };
            const onRetry = jest.fn();

            (global.fetch as jest.Mock)
                .mockRejectedValueOnce(mockError)
                .mockResolvedValueOnce(mockResponse);

            const { fetchWithRetry } = require('@/services/api');
            await fetchWithRetry('http://api.example.com/test', undefined, { onRetry });

            expect(onRetry).toHaveBeenCalledWith(
                'https://api.example.com/test',
                mockError,
                1
            );
        });

        it('should throw after max attempts', async () => {
            const mockError = new Error('Network error');

            (global.fetch as jest.Mock).mockRejectedValue(mockError);

            const { fetchWithRetry } = require('@/services/api');

            await expect(
                fetchWithRetry('https://api.example.com/test', undefined, { maxAttempts: 2 })
            ).rejects.toThrow('Network error');
        });

        it('should not retry if URL already uses HTTPS', async () => {
            const mockError = new Error('Network error');

            (global.fetch as jest.Mock).mockRejectedValue(mockError);

            const { fetchWithRetry } = require('@/services/api');

            await expect(
                fetchWithRetry('https://api.example.com/test')
            ).rejects.toThrow('Network error');

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });
});
