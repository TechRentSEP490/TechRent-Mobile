import type { ContractResponse } from '@/services/contracts';

export type OrderStatusFilter = 'All' | 'Pending' | 'Delivered' | 'In Use' | 'Completed';
export type OrderStatus = Exclude<OrderStatusFilter, 'All'>;

export type OrderActionType =
  | 'continueProcess'
  | 'extendRental'
  | 'confirmReceipt'
  | 'cancelOrder'
  | 'rentAgain'
  | 'completeKyc';

export type OrderCard = {
  orderId: number;
  id: string;
  title: string;
  deviceSummary: string;
  rentalPeriod: string;
  totalAmount: string;
  totalPrice: number;
  totalPriceLabel: string;
  depositAmount: number;
  depositLabel: string;
  totalDue: number;
  statusFilter: OrderStatus;
  statusLabel: string;
  statusColor: string;
  statusBackground: string;
  action?: {
    label: string;
    type: OrderActionType;
  };
  contract?: ContractResponse | null;
};
