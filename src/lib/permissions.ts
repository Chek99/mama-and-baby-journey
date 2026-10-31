/**
 * Role and permission rules (spec section 3). Pure functions used by server
 * actions; the database row-level security policies enforce the same scope.
 */

export type AppRole = "system_admin" | "hospital_admin" | "clinician" | "chv" | "mother";

export const STAFF_PASSWORD_ROLES: AppRole[] = ["system_admin", "hospital_admin", "clinician"];
export const PHONE_SIGN_IN_ROLES: AppRole[] = ["mother", "chv"];

export interface Actor {
  userId: string;
  roles: AppRole[];
  facilityId: string | null;
}

export interface StaffTarget {
  userId: string;
  roles: AppRole[];
  facilityId: string | null;
}

export function hasRole(actor: { roles: AppRole[] }, role: AppRole): boolean {
  return actor.roles.includes(role);
}

/** Only doctors/nurses (clinician role) may record a vaccine as given. */
export function canRecordVaccineGiven(actor: { roles: AppRole[] }): boolean {
  return actor.roles.includes("clinician");
}

/** Roles a given actor may assign when adding or changing staff. */
export function assignableRoles(actor: { roles: AppRole[] }): AppRole[] {
  if (actor.roles.includes("hospital_admin")) return ["clinician", "chv", "hospital_admin"];
  if (actor.roles.includes("system_admin")) return ["hospital_admin"];
  return [];
}

/**
 * A hospital admin manages staff of their own facility only. Nobody can manage
 * a system admin through staff screens, and admins cannot deactivate or
 * demote themselves.
 */
export function canManageStaffMember(actor: Actor, target: StaffTarget): boolean {
  if (target.roles.includes("system_admin") || target.roles.includes("mother")) return false;
  if (actor.userId === target.userId) return false;
  if (actor.roles.includes("hospital_admin")) {
    return !!actor.facilityId && actor.facilityId === target.facilityId;
  }
  if (actor.roles.includes("system_admin")) {
    return target.roles.includes("hospital_admin");
  }
  return false;
}

export function canViewAuditForFacility(actor: Actor, facilityId: string | null): boolean {
  if (actor.roles.includes("system_admin")) return true;
  return actor.roles.includes("hospital_admin") && !!actor.facilityId && actor.facilityId === facilityId;
}

/** Which portal a signed-in user lands on. */
export function portalPathFor(roles: AppRole[]): "/admin" | "/facility" | "/clinician" | "/chv" | "/mother" | "/" {
  if (roles.includes("system_admin")) return "/admin";
  if (roles.includes("hospital_admin")) return "/facility";
  if (roles.includes("clinician")) return "/clinician";
  if (roles.includes("chv")) return "/chv";
  if (roles.includes("mother")) return "/mother";
  return "/";
}

export function signsInWithPassword(roles: AppRole[]): boolean {
  return roles.some((r) => STAFF_PASSWORD_ROLES.includes(r));
}

export function signsInWithPhone(roles: AppRole[]): boolean {
  return roles.some((r) => PHONE_SIGN_IN_ROLES.includes(r)) && !signsInWithPassword(roles);
}
