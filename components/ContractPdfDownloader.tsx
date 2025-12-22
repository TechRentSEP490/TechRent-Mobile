import * as FileSystem from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { ReactNode, useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { fetchContractById, type ContractResponse } from '@/services/contracts';
import type { AuthSession } from '@/stores/auth-store';
import { formatContractStatus, formatCurrency, formatDateTime } from '@/utils/order-formatters';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeRichHtml = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return '';
  }

  return trimmed
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>.*?<\/?head>/gis, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();
};

const buildContractPdfHtml = (
  contract: ContractResponse,
  contextLabel?: string,
): string => {
  const fallbackTitle = contextLabel ? `${contextLabel} Contract` : `Contract #${contract.contractId}`;
  const contractTitle = contract.title && contract.title.trim().length > 0 ? contract.title.trim() : fallbackTitle;
  const contractNumber =
    contract.contractNumber && contract.contractNumber.trim().length > 0
      ? contract.contractNumber.trim()
      : contract.contractId
        ? `#${contract.contractId}`
        : '';
  const contractStatusLabel = formatContractStatus(contract.status);
  const totalAmountLabel =
    typeof contract.totalAmount === 'number' ? formatCurrency(contract.totalAmount) : undefined;
  const depositAmountLabel =
    typeof contract.depositAmount === 'number' ? formatCurrency(contract.depositAmount) : undefined;

  const metadata: { label: string; value: string }[] = [];

  if (contractNumber) {
    metadata.push({ label: 'Contract Number', value: contractNumber });
  }

  if (contractStatusLabel && contractStatusLabel !== 'Unknown') {
    metadata.push({ label: 'Status', value: contractStatusLabel });
  }

  if (contract.startDate) {
    metadata.push({ label: 'Start Date', value: formatDateTime(contract.startDate) });
  }

  if (contract.endDate) {
    metadata.push({ label: 'End Date', value: formatDateTime(contract.endDate) });
  }

  if (contract.signedAt) {
    metadata.push({ label: 'Signed At', value: formatDateTime(contract.signedAt) });
  }

  if (totalAmountLabel) {
    metadata.push({ label: 'Total Amount', value: totalAmountLabel });
  }

  if (depositAmountLabel) {
    metadata.push({ label: 'Deposit Amount', value: depositAmountLabel });
  }

  const sanitizedContent = sanitizeRichHtml(contract.contractContent);
  const sanitizedTerms = sanitizeRichHtml(contract.termsAndConditions);

  const resolveSignatureName = (
    value: number | string | null | undefined,
    fallback: string,
  ): string => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    if (typeof value === 'number') {
      return `${fallback} #${value}`;
    }

    return fallback;
  };

  const normalizeSignatureDateLabel = (value: string | null | undefined): string | null => {
    if (!value) {
      return null;
    }

    const formatted = formatDateTime(value);

    if (!formatted || formatted === '—') {
      return null;
    }

    return formatted;
  };

  // Check if customer has signed using signedAt field (or fallback to customerSignedBy)
  const isCustomerSigned = (() => {
    // First check signedAt - API uses this as primary indicator
    const signedAt = contract.signedAt;
    if (signedAt && signedAt !== 'null' && typeof signedAt === 'string' && signedAt.trim().length > 0) {
      return true;
    }
    // Fallback to customerSignedBy for backwards compatibility
    return contract.customerSignedBy !== null && contract.customerSignedBy !== undefined;
  })();
  const isAdminSigned = contract.adminSignedBy !== null && contract.adminSignedBy !== undefined;
  const customerBaseName = resolveSignatureName(contract.customerSignedBy ?? null, 'Khách hàng');
  const adminBaseName = resolveSignatureName(contract.adminSignedBy ?? null, 'CÔNG TY TECHRENT');
  const customerSignedCaption = `${customerBaseName} đã ký`;
  const adminSignedCaption = `${adminBaseName} đã ký`;
  const customerUnsignedCaption = '(Ký, ghi rõ họ tên)';
  const adminUnsignedCaption = adminBaseName;
  // Use signedAt for customer signed date if customerSignedAt is not available
  const customerSignedAtLabel = normalizeSignatureDateLabel(contract.customerSignedAt ?? contract.signedAt ?? null);
  const adminSignedAtLabel = normalizeSignatureDateLabel(contract.adminSignedAt ?? null);

  const sections: string[] = [];

  if (sanitizedContent.length > 0) {
    sections.push(`<section><h2>Agreement</h2>${sanitizedContent}</section>`);
  }

  if (sanitizedTerms.length > 0) {
    sections.push(`<section><h2>Terms &amp; Conditions</h2>${sanitizedTerms}</section>`);
  }

  if (sections.length === 0) {
    sections.push('<section><p>No contract content is available at this time.</p></section>');
  }

  const signatureSection = `
    <section class="signature-section">
      <h2>Chữ ký</h2>
      <div class="signature-grid">
        <div class="signature-card">
          <p class="signature-role">Đại diện bên A</p>
          <div class="signature-box">
            ${isAdminSigned ? '<span class="signature-check">✔</span>' : ''}
          </div>
          ${isAdminSigned
      ? `<p class="signature-caption">${escapeHtml(adminSignedCaption)}</p>`
      : `<p class="signature-caption signature-placeholder">${escapeHtml(adminUnsignedCaption)}</p>`
    }
          ${adminSignedAtLabel
      ? `<p class="signature-date">Ký ngày: ${escapeHtml(adminSignedAtLabel)}</p>`
      : ''
    }
        </div>
        <div class="signature-card">
          <p class="signature-role">Đại diện bên B</p>
          <div class="signature-box">
            ${isCustomerSigned ? '<span class="signature-check">✔</span>' : ''}
          </div>
          ${isCustomerSigned
      ? `<p class="signature-caption">${escapeHtml(customerSignedCaption)}</p>`
      : `<p class="signature-caption signature-placeholder">${escapeHtml(customerUnsignedCaption)}</p>`
    }
          ${customerSignedAtLabel
      ? `<p class="signature-date">Ký ngày: ${escapeHtml(customerSignedAtLabel)}</p>`
      : ''
    }
        </div>
      </div>
    </section>
  `;

  sections.push(signatureSection);

  const metadataHtml = metadata
    .map(
      (item) =>
        `<div class="meta-row"><span class="meta-label">${escapeHtml(item.label)}:</span><span class="meta-value">${escapeHtml(item.value)}</span></div>`,
    )
    .join('');

  const contextHeading = contextLabel ? `<p class="context">${escapeHtml(contextLabel)}</p>` : '';

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 32px;
          color: #111111;
          line-height: 1.6;
          font-size: 14px;
        }

        h1 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        h2 {
          font-size: 18px;
          margin-bottom: 8px;
          margin-top: 24px;
        }

        p {
          margin: 0 0 12px 0;
        }

        .context {
          color: #4b5563;
          margin-bottom: 16px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
          padding: 6px 0;
        }

        .meta-label {
          font-weight: 600;
          color: #374151;
        }

        .meta-value {
          color: #111827;
        }

        section {
          margin-top: 16px;
        }

        section:first-of-type {
          margin-top: 24px;
        }

        ul {
          padding-left: 20px;
        }

        li {
          margin-bottom: 8px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        th,
        td {
          border: 1px solid #d1d5db;
          padding: 8px;
          text-align: left;
        }

        strong {
          font-weight: 600;
        }

        .signature-section {
          margin-top: 32px;
        }

        .signature-grid {
          display: flex;
          gap: 24px;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .signature-card {
          flex: 1 1 240px;
          text-align: center;
        }

        .signature-role {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .signature-box {
          border: 2px solid #d1d5db;
          border-radius: 12px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .signature-check {
          color: #22c55e;
          font-size: 48px;
        }

        .signature-caption {
          font-weight: 600;
        }

        .signature-placeholder {
          color: #9ca3af;
          font-style: italic;
        }

        .signature-date {
          color: #4b5563;
          font-size: 12px;
          margin-top: 4px;
        }

        .signature-card:last-child .signature-box {
          border-style: dashed;
        }

        .signature-card:last-child .signature-box::after {
          content: 'Sign here';
          color: #d1d5db;
          font-size: 12px;
        }

        .signature-card:last-child .signature-box .signature-check {
          color: #14b8a6;
        }

        .signature-card:last-child .signature-box .signature-caption {
          color: #065f46;
        }

        .signature-card:last-child .signature-caption.signature-placeholder {
          color: #6b7280;
          font-weight: 500;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(contractTitle)}</h1>
      ${contextHeading}
      ${metadataHtml}
      ${sections.join('\n')}
    </body>
  </html>`;
};

type ContractPdfDownloaderRenderProps = {
  downloadingContractId: number | null;
  downloadContract: (contract: ContractResponse | null, contextLabel?: string | null) => Promise<void>;
};

type FileSystemWithDirectories = typeof FileSystem & {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
};

const fsDirectories = FileSystem as FileSystemWithDirectories;
const defaultDocumentDirectory = fsDirectories.documentDirectory ?? null;
const defaultCacheDirectory = fsDirectories.cacheDirectory ?? null;

type ContractPdfDownloaderProps = {
  session: AuthSession | null;
  ensureSession: () => Promise<AuthSession | null>;
  children: (props: ContractPdfDownloaderRenderProps) => ReactNode;
};

export default function ContractPdfDownloader({
  session,
  ensureSession,
  children,
}: ContractPdfDownloaderProps) {
  const [downloadingContractId, setDownloadingContractId] = useState<number | null>(null);

  const downloadContract = useCallback<ContractPdfDownloaderRenderProps['downloadContract']>(
    async (contract, contextLabel) => {
      if (!contract?.contractId) {
        Alert.alert('Download contract', 'Contract details are unavailable. Please try again later.');
        return;
      }

      const contractId = contract.contractId;

      try {
        if (Platform.OS === 'web') {
          Alert.alert(
            'Download unavailable',
            'Contract downloads are only supported from the mobile application.',
          );
          return;
        }

        setDownloadingContractId(contractId);

        const activeSession = session?.accessToken ? session : await ensureSession();

        if (!activeSession?.accessToken) {
          throw new Error('You must be signed in to download the contract.');
        }

        const sessionCredentials = {
          accessToken: activeSession.accessToken,
          tokenType: activeSession.tokenType,
        };

        let contractDetails: ContractResponse | null = contract ?? null;
        const hasExistingContent = Boolean(
          contractDetails &&
          ((contractDetails.contractContent && contractDetails.contractContent.trim().length > 0) ||
            (contractDetails.termsAndConditions && contractDetails.termsAndConditions.trim().length > 0)),
        );

        if (!hasExistingContent) {
          contractDetails = await fetchContractById(sessionCredentials, contractId);
        }

        const hasDownloadableContent = Boolean(
          contractDetails &&
          ((contractDetails.contractContent && contractDetails.contractContent.trim().length > 0) ||
            (contractDetails.termsAndConditions && contractDetails.termsAndConditions.trim().length > 0)),
        );

        if (!hasDownloadableContent || !contractDetails) {
          throw new Error('The contract details are not yet available for download.');
        }

        const html = buildContractPdfHtml(contractDetails, contextLabel ?? undefined);
        const pdfResult = await printToFileAsync({
          html,
        });

        if (!pdfResult?.uri) {
          throw new Error('Failed to generate the contract PDF. Please try again.');
        }

        const normalizedPath =
          Platform.OS === 'android' && !pdfResult.uri.startsWith('file://')
            ? `file://${pdfResult.uri}`
            : pdfResult.uri;

        const shareTitle =
          contextLabel && contextLabel.trim().length > 0
            ? `${contextLabel} Contract`
            : contractDetails.title && contractDetails.title.trim().length > 0
              ? contractDetails.title.trim()
              : `Contract #${contractId}`;
        const isSharingAvailable = await Sharing.isAvailableAsync();

        if (!isSharingAvailable) {
          const fallbackDir = defaultDocumentDirectory ?? defaultCacheDirectory;

          if (!fallbackDir) {
            throw new Error('Sharing contracts is not supported on this device.');
          }

          const timestamp = Date.now();
          const fallbackPath = `${fallbackDir}contract-${contractId}-${timestamp}.pdf`;

          await FileSystem.copyAsync({ from: normalizedPath, to: fallbackPath });

          Alert.alert(
            'Contract saved',
            `Sharing is not available on this device. The contract PDF has been saved to:\n${fallbackPath}`,
          );
          return;
        }

        await Sharing.shareAsync(normalizedPath, {
          mimeType: 'application/pdf',
          dialogTitle: shareTitle,
          UTI: 'com.adobe.pdf',
        });
      } catch (error) {
        const fallbackMessage = 'Unable to download the contract. Please try again later.';
        const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
        Alert.alert(
          'Download contract',
          normalizedError.message && normalizedError.message.trim().length > 0
            ? normalizedError.message
            : fallbackMessage,
        );
      } finally {
        setDownloadingContractId((current) => (current === contractId ? null : current));
      }
    },
    [ensureSession, session],
  );

  return <>{children({ downloadContract, downloadingContractId })}</>;
}

