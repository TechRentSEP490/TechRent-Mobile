/**
 * MSW Handlers - Mock API responses for testing
 * Sử dụng cho API Contract Testing (test 400/401/500 responses)
 */
import { http, HttpResponse } from 'msw';

const API_BASE = 'http://test-api.example.com';

// ============================================
// SUCCESS HANDLERS (200 OK)
// ============================================
export const successHandlers = [
    // Auth - Login
    http.post(`${API_BASE}/api/auth/login`, () => {
        return HttpResponse.json({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            userId: 'user-123',
        });
    }),

    // Device Models
    http.get(`${API_BASE}/api/device-models`, () => {
        return HttpResponse.json({
            content: [
                {
                    deviceModelId: 'model-1',
                    deviceModelName: 'Test Device',
                    price: 100000,
                    stock: 10,
                },
            ],
            totalPages: 1,
            totalElements: 1,
        });
    }),

    // Rental Orders
    http.get(`${API_BASE}/api/rental-orders/:orderId`, ({ params }) => {
        return HttpResponse.json({
            rentalOrderId: params.orderId,
            orderStatus: 'PENDING',
            totalAmount: 500000,
        });
    }),
];

// ============================================
// ERROR HANDLERS - 400 Bad Request
// ============================================
export const badRequestHandlers = [
    http.post(`${API_BASE}/api/auth/login`, () => {
        return HttpResponse.json(
            { message: 'Invalid credentials' },
            { status: 400 }
        );
    }),

    http.post(`${API_BASE}/api/rental-orders`, () => {
        return HttpResponse.json(
            { message: 'Validation failed', errors: ['startDate is required'] },
            { status: 400 }
        );
    }),
];

// ============================================
// ERROR HANDLERS - 401 Unauthorized
// ============================================
export const unauthorizedHandlers = [
    http.get(`${API_BASE}/api/rental-orders`, () => {
        return HttpResponse.json(
            { message: 'Unauthorized - Token expired' },
            { status: 401 }
        );
    }),

    http.get(`${API_BASE}/api/users/me`, () => {
        return HttpResponse.json(
            { message: 'Unauthorized' },
            { status: 401 }
        );
    }),
];

// ============================================
// ERROR HANDLERS - 500 Server Error
// ============================================
export const serverErrorHandlers = [
    http.get(`${API_BASE}/api/device-models`, () => {
        return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }),
];

// ============================================
// EMPTY DATA HANDLERS
// ============================================
export const emptyDataHandlers = [
    http.get(`${API_BASE}/api/device-models`, () => {
        return HttpResponse.json({
            content: [],
            totalPages: 0,
            totalElements: 0,
        });
    }),

    http.get(`${API_BASE}/api/rental-orders`, () => {
        return HttpResponse.json([]);
    }),
];

// Default handlers (success cases)
export const handlers = [...successHandlers];
