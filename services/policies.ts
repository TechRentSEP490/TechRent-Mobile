import { buildApiUrl } from './api';

// ============================================================
// TYPES - Định nghĩa kiểu dữ liệu cho Policy
// ============================================================

export interface Policy {
    policyId: number;
    title: string;
    description: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    effectiveFrom: string;
    effectiveTo: string;
    createdBy: string;
    createdAt: string;
    updatedBy: string | null;
    updatedAt: string | null;
    deletedBy: string | null;
    deletedAt: string | null;
}

interface PoliciesResponse {
    status: string;
    message: string;
    details: string;
    code: number;
    data: Policy[];
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Fetch danh sách policies (public, không cần auth)
 * GET /api/admin/policies
 */
export async function fetchPolicies(): Promise<Policy[]> {
    const response = await fetch(buildApiUrl('admin/policies'), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('Không thể tải danh sách chính sách');
    }

    const result: PoliciesResponse = await response.json();

    if (result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Không thể tải danh sách chính sách');
    }

    return result.data;
}

/**
 * Lấy policy đang có hiệu lực (effectiveFrom <= today <= effectiveTo)
 */
export function getActivePolicy(policies: Policy[]): Policy | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePolicies = policies.filter((policy) => {
        const effectiveFrom = new Date(policy.effectiveFrom);
        const effectiveTo = new Date(policy.effectiveTo);
        effectiveFrom.setHours(0, 0, 0, 0);
        effectiveTo.setHours(23, 59, 59, 999);

        return today >= effectiveFrom && today <= effectiveTo;
    });

    // Trả về policy mới nhất nếu có nhiều policy active
    if (activePolicies.length === 0) {
        return null;
    }

    return activePolicies.sort((a, b) =>
        new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    )[0];
}
