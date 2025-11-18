import type { ProductDetail } from '@/constants/products';

export type SupportedCurrency = 'USD' | 'VND';

export const formatCurrencyValue = (value: number, currency: SupportedCurrency) =>
  new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value);

export const determineCurrency = (product: ProductDetail): SupportedCurrency => {
  if (product.currency) {
    return product.currency;
  }

  return product.price.includes('$') ? 'USD' : 'VND';
};

export const getDailyRate = (product: ProductDetail) => {
  if (typeof product.pricePerDay === 'number' && product.pricePerDay > 0) {
    return product.pricePerDay;
  }

  const sanitized = product.price.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getDepositRatio = (product: ProductDetail) => {
  if (typeof product.depositPercent === 'number') {
    return product.depositPercent;
  }

  if (typeof product.depositPercentage === 'number') {
    return product.depositPercentage / 100;
  }

  return null;
};

export const getDeviceValue = (product: ProductDetail) => {
  if (typeof product.deviceValue === 'number' && Number.isFinite(product.deviceValue)) {
    return product.deviceValue;
  }

  return null;
};
