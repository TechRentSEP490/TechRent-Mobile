/**
 * HandoverPdfDownloader
 * Generates and downloads/shares handover report PDFs on mobile
 * Following the pattern from ContractPdfDownloader.tsx
 */

import * as FileSystem from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { ReactNode, useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { ConditionDefinition, HandoverReport } from '@/types/handover-reports';
import { buildHandoverReportHtml } from '@/utils/handover-pdf-utils';

type FileSystemWithDirectories = typeof FileSystem & {
    documentDirectory?: string | null;
    cacheDirectory?: string | null;
};

const fsDirectories = FileSystem as FileSystemWithDirectories;
const defaultDocumentDirectory = fsDirectories.documentDirectory ?? null;
const defaultCacheDirectory = fsDirectories.cacheDirectory ?? null;

export type HandoverPdfDownloaderRenderProps = {
    downloadingReportId: number | null;
    downloadHandoverReport: (report: HandoverReport | null) => Promise<void>;
};

type HandoverPdfDownloaderProps = {
    children: (props: HandoverPdfDownloaderRenderProps) => ReactNode;
    /** Condition definitions for displaying proper condition names in PDF */
    conditionDefinitions?: ConditionDefinition[];
};

export default function HandoverPdfDownloader({
    children,
    conditionDefinitions = [],
}: HandoverPdfDownloaderProps) {
    const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);

    const downloadHandoverReport = useCallback<HandoverPdfDownloaderRenderProps['downloadHandoverReport']>(
        async (report) => {
            if (!report?.handoverReportId) {
                Alert.alert('Tải biên bản', 'Không có thông tin biên bản. Vui lòng thử lại.');
                return;
            }

            const reportId = report.handoverReportId;

            try {
                if (Platform.OS === 'web') {
                    Alert.alert(
                        'Không khả dụng',
                        'Tải biên bản chỉ hỗ trợ trên ứng dụng di động.',
                    );
                    return;
                }

                setDownloadingReportId(reportId);

                // Generate HTML for the report with condition definitions for proper names
                const html = buildHandoverReportHtml(report, conditionDefinitions);

                // Convert HTML to PDF using expo-print
                const pdfResult = await printToFileAsync({ html });

                if (!pdfResult?.uri) {
                    throw new Error('Không thể tạo file PDF. Vui lòng thử lại.');
                }

                const normalizedPath =
                    Platform.OS === 'android' && !pdfResult.uri.startsWith('file://')
                        ? `file://${pdfResult.uri}`
                        : pdfResult.uri;

                const reportType = report.handoverType === 'CHECKIN' ? 'Biên bản thu hồi' : 'Biên bản bàn giao';
                const shareTitle = `${reportType} #${reportId}`;

                const isSharingAvailable = await Sharing.isAvailableAsync();

                if (!isSharingAvailable) {
                    const fallbackDir = defaultDocumentDirectory ?? defaultCacheDirectory;

                    if (!fallbackDir) {
                        throw new Error('Không hỗ trợ chia sẻ file trên thiết bị này.');
                    }

                    const timestamp = Date.now();
                    const fallbackPath = `${fallbackDir}handover-report-${reportId}-${timestamp}.pdf`;

                    await FileSystem.copyAsync({ from: normalizedPath, to: fallbackPath });

                    Alert.alert(
                        'Đã lưu biên bản',
                        `File PDF đã được lưu tại:\n${fallbackPath}`,
                    );
                    return;
                }

                await Sharing.shareAsync(normalizedPath, {
                    mimeType: 'application/pdf',
                    dialogTitle: shareTitle,
                    UTI: 'com.adobe.pdf',
                });
            } catch (error) {
                const fallbackMessage = 'Không thể tải biên bản. Vui lòng thử lại.';
                const normalizedError = error instanceof Error ? error : new Error(fallbackMessage);
                Alert.alert(
                    'Lỗi tải biên bản',
                    normalizedError.message && normalizedError.message.trim().length > 0
                        ? normalizedError.message
                        : fallbackMessage,
                );
            } finally {
                setDownloadingReportId((current) => (current === reportId ? null : current));
            }
        },
        [conditionDefinitions],
    );

    return <>{children({ downloadHandoverReport, downloadingReportId })}</>;
}
