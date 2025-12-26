import type { ContractResponse } from '@/services/contracts';

// Filter categories (grouped)
export type OrderStatusCategory = 'All' | 'Pending' | 'Delivered' | 'In Use' | 'Completed';

// Specific order statuses from API
export type OrderStatusValue =
  | 'PENDING_KYC'
  | 'PENDING'
  | 'PROCESSING'
  | 'DELIVERING'
  | 'RESCHEDULED'
  | 'DELIVERY_CONFIRMED'
  | 'IN_USE'
  | 'CANCELLED'
  | 'REJECTED'
  | 'COMPLETED';

// Combined filter type (can filter by category OR specific status)
export type OrderStatusFilter = OrderStatusCategory | OrderStatusValue;

// For mapping to categories (used in card display)
export type OrderStatus = Exclude<OrderStatusCategory, 'All'>;

export type OrderActionType =
  | 'continueProcess'
  | 'extendRental'
  | 'confirmReceipt'
  | 'cancelOrder'
  | 'rentAgain'
  | 'completeKyc';

export type DeviceLookupEntry = {
  name: string;
  imageURL?: string | null;
};

export type OrderCard = {
  orderId: number;
  id: string;
  title: string;
  deviceSummary: string;
  deviceImageUrls: string[];
  rentalPeriod: string;
  planStartDate: string; // Ngày dự kiến bắt đầu
  planEndDate: string;   // Ngày dự kiến kết thúc
  totalAmount: string;
  totalPrice: number;
  totalPriceLabel: string;
  depositAmount: number;
  depositLabel: string;
  totalDue: number;
  rawStatus: string; // Original API status value (e.g., 'PENDING_KYC', 'DELIVERY_CONFIRMED')
  statusFilter: OrderStatus; // Category for display (Pending, Delivered, In Use, Completed)
  statusLabel: string;
  statusColor: string;
  statusBackground: string;
  action?: {
    label: string;
    type: OrderActionType;
  };
  contract?: ContractResponse | null;
};
