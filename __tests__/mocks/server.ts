/**
 * MSW Server Setup - cho Node.js test environment
 * Sử dụng trong Jest tests
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup server với default handlers
export const server = setupServer(...handlers);

// Helper function để thay đổi handlers trong test cụ thể
export const useErrorHandlers = (errorHandlers: any[]) => {
    server.use(...errorHandlers);
};
