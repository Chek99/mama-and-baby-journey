/** Data shapes exchanged with the external backend (see docs/BACKEND_API.md). */
import type { PublicAuthError } from "@/lib/auth-rules";
import type { AppRole } from "@/lib/permissions";
import type { SessionTokens } from "./http";

export type { SessionTokens };

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type Fail = { ok: false; error: PublicAuthError };

export interface MeDto {
  verified: boolean;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  staffId: string | null;
  language: "en" | "sw";
  roles: AppRole[];
  portal: string;
  mustChangePassword: boolean;
  usesPassword: boolean;
  facility: { id: string; name: string; isActive: boolean } | null;
  idleMinutes: number;
}

export interface FacilityDto {
  id: string;
  name: string;
  mflCode: string | null;
  county: string;
  subCounty: string | null;
  ward: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  services: string[];
  isActive: boolean;
}

export interface FacilityInput {
  id?: string | undefined;
  name: string;
  mflCode?: string | undefined;
  county: string;
  subCounty?: string | undefined;
  ward?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  services?: string[] | undefined;
}

export interface AuditDto {
  id: number;
  at: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  facilityName: string | null;
  entityType: string | null;
  success: boolean;
  ip: string | null;
  device: string | null;
}

export interface SettingDto {
  key: string;
  value: Json;
  description: string | null;
  updatedAt: string;
}

export interface StaffDto {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  staffId: string | null;
  licenceNumber: string | null;
  cadre: string | null;
  role: AppRole;
  ward: string | null;
  facilityId: string | null;
  facilityName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AddStaffInput {
  role: "hospital_admin" | "clinician" | "chv";
  facilityId?: string | undefined;
  fullName: string;
  email?: string | undefined;
  phone?: string | undefined;
  staffId?: string | undefined;
  licenceNumber?: string | undefined;
  cadre?: string | undefined;
  ward?: string | undefined;
}

export type SignedIn = { ok: true; session: SessionTokens; portal: string; mustChangePassword: boolean; deviceToken?: string | undefined };
