/**
 * Unit Tests for utils/dates.ts
 * Test các hàm xử lý ngày tháng
 */
import {
    addDays,
    addMonths,
    clampToStartOfDay,
    endOfMonth,
    formatDisplayDate,
    generateCalendarDays,
    isSameDay,
    parseDateParam,
    startOfMonth,
    WEEKDAY_LABELS,
} from '@/utils/dates';

describe('dates utility functions', () => {
    // ============================================
    // clampToStartOfDay
    // ============================================
    describe('clampToStartOfDay', () => {
        it('should set time to 00:00:00.000', () => {
            const date = new Date(2024, 0, 15, 14, 30, 45, 123);
            const result = clampToStartOfDay(date);

            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
        });

        it('should preserve the date part', () => {
            const date = new Date(2024, 5, 20, 23, 59, 59);
            const result = clampToStartOfDay(date);

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(5);
            expect(result.getDate()).toBe(20);
        });

        it('should not mutate the original date', () => {
            const original = new Date(2024, 0, 15, 14, 30);
            const originalTime = original.getTime();
            clampToStartOfDay(original);

            expect(original.getTime()).toBe(originalTime);
        });
    });

    // ============================================
    // addDays
    // ============================================
    describe('addDays', () => {
        it('should add positive days correctly', () => {
            const date = new Date(2024, 0, 15);
            const result = addDays(date, 5);

            expect(result.getDate()).toBe(20);
            expect(result.getMonth()).toBe(0);
        });

        it('should subtract days with negative value', () => {
            const date = new Date(2024, 0, 15);
            const result = addDays(date, -10);

            expect(result.getDate()).toBe(5);
        });

        it('should handle month overflow correctly', () => {
            const date = new Date(2024, 0, 30);
            const result = addDays(date, 5);

            expect(result.getMonth()).toBe(1); // February
            expect(result.getDate()).toBe(4);
        });

        it('should handle year overflow correctly', () => {
            const date = new Date(2024, 11, 30);
            const result = addDays(date, 5);

            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0);
        });
    });

    // ============================================
    // startOfMonth
    // ============================================
    describe('startOfMonth', () => {
        it('should return first day of the month', () => {
            const date = new Date(2024, 5, 15);
            const result = startOfMonth(date);

            expect(result.getDate()).toBe(1);
            expect(result.getMonth()).toBe(5);
            expect(result.getFullYear()).toBe(2024);
        });
    });

    // ============================================
    // addMonths
    // ============================================
    describe('addMonths', () => {
        it('should add months correctly', () => {
            const date = new Date(2024, 0, 15);
            const result = addMonths(date, 3);

            expect(result.getMonth()).toBe(3); // April
            expect(result.getDate()).toBe(1);
        });

        it('should handle year overflow', () => {
            const date = new Date(2024, 10, 15);
            const result = addMonths(date, 3);

            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(1); // February
        });
    });

    // ============================================
    // endOfMonth
    // ============================================
    describe('endOfMonth', () => {
        it('should return last day of January (31 days)', () => {
            const date = new Date(2024, 0, 15);
            const result = endOfMonth(date);

            expect(result.getDate()).toBe(31);
            expect(result.getMonth()).toBe(0);
        });

        it('should return last day of February in leap year (29 days)', () => {
            const date = new Date(2024, 1, 10);
            const result = endOfMonth(date);

            expect(result.getDate()).toBe(29);
        });

        it('should return last day of February in non-leap year (28 days)', () => {
            const date = new Date(2023, 1, 10);
            const result = endOfMonth(date);

            expect(result.getDate()).toBe(28);
        });
    });

    // ============================================
    // isSameDay
    // ============================================
    describe('isSameDay', () => {
        it('should return true for same dates', () => {
            const date1 = new Date(2024, 0, 15, 0, 0, 0, 0);
            const date2 = new Date(2024, 0, 15, 0, 0, 0, 0);

            expect(isSameDay(date1, date2)).toBe(true);
        });

        it('should return false for different dates', () => {
            const date1 = new Date(2024, 0, 15);
            const date2 = new Date(2024, 0, 16);

            expect(isSameDay(date1, date2)).toBe(false);
        });
    });

    // ============================================
    // formatDisplayDate
    // ============================================
    describe('formatDisplayDate', () => {
        it('should format date correctly', () => {
            const date = new Date(2024, 0, 15);
            const result = formatDisplayDate(date);

            // Format: "Jan 15, 2024" (locale dependent, but should contain these parts)
            expect(result).toContain('2024');
            expect(result).toContain('15');
        });
    });

    // ============================================
    // generateCalendarDays
    // ============================================
    describe('generateCalendarDays', () => {
        it('should return 42 days (6 weeks)', () => {
            const date = new Date(2024, 0, 1);
            const result = generateCalendarDays(date);

            expect(result).toHaveLength(42);
        });

        it('should include first day of the month', () => {
            const date = new Date(2024, 5, 1);
            const result = generateCalendarDays(date);

            const hasFirstDay = result.some(
                (d) => d.getMonth() === 5 && d.getDate() === 1
            );
            expect(hasFirstDay).toBe(true);
        });
    });

    // ============================================
    // parseDateParam
    // ============================================
    describe('parseDateParam', () => {
        it('should parse valid date string', () => {
            const fallback = new Date(2020, 0, 1);
            const result = parseDateParam('2024-06-15', fallback);

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(5); // June is 5 (0-indexed)
            expect(result.getDate()).toBe(15);
        });

        it('should return fallback for invalid string', () => {
            const fallback = new Date(2020, 0, 1);
            const result = parseDateParam('invalid-date', fallback);

            expect(result.getFullYear()).toBe(2020);
        });

        it('should return fallback for non-string value', () => {
            const fallback = new Date(2020, 0, 1);
            const result = parseDateParam(12345, fallback);

            expect(result.getFullYear()).toBe(2020);
        });

        it('should return fallback for null/undefined', () => {
            const fallback = new Date(2020, 0, 1);

            expect(parseDateParam(null, fallback).getFullYear()).toBe(2020);
            expect(parseDateParam(undefined, fallback).getFullYear()).toBe(2020);
        });
    });

    // ============================================
    // WEEKDAY_LABELS constant
    // ============================================
    describe('WEEKDAY_LABELS', () => {
        it('should have 7 days', () => {
            expect(WEEKDAY_LABELS).toHaveLength(7);
        });

        it('should start with Sunday', () => {
            expect(WEEKDAY_LABELS[0]).toBe('Sun');
        });

        it('should end with Saturday', () => {
            expect(WEEKDAY_LABELS[6]).toBe('Sat');
        });
    });
});
