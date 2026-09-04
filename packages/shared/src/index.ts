export type UserRole = "landlord" | "tenant" | "manager";
export type Plan = "free" | "premium";
export type PaymentStatus = "pending" | "approved" | "rejected";
export interface ApiResponse<T> { data: T; message?: string }
export interface Property { id: string; landlordId: string; name: string; address: string; monthlyRent: number; images: string[]; isPublished: boolean }
export interface Tenancy { id: string; propertyId: string; landlordId: string; tenantId: string; unit: string; rentAmount: number; status: "active" | "ended" }
