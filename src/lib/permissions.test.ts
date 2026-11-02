import { describe, expect, it } from "vitest";
import { assignableRoles, canManageStaffMember, canRecordVaccineGiven, canViewAuditForFacility, portalPathFor, signsInWithPassword, signsInWithPhone } from "./permissions";

const hospitalAdmin = { userId: "a", roles: ["hospital_admin" as const], facilityId: "f1" };
const systemAdmin = { userId: "s", roles: ["system_admin" as const], facilityId: null };

describe("permissions", () => {
  it("sends each role to its own portal", () => {
    expect(portalPathFor(["system_admin"])).toBe("/admin");
    expect(portalPathFor(["hospital_admin"])).toBe("/facility");
    expect(portalPathFor(["clinician"])).toBe("/clinician");
    expect(portalPathFor(["chv"])).toBe("/chv");
    expect(portalPathFor(["mother"])).toBe("/mother");
    expect(portalPathFor([])).toBe("/");
  });

  it("only clinicians can record a vaccine as given", () => {
    expect(canRecordVaccineGiven({ roles: ["clinician"] })).toBe(true);
    expect(canRecordVaccineGiven({ roles: ["hospital_admin"] })).toBe(false);
    expect(canRecordVaccineGiven({ roles: ["chv"] })).toBe(false);
  });

  it("limits which roles each admin can assign", () => {
    expect(assignableRoles(systemAdmin)).toEqual(["hospital_admin"]);
    expect(assignableRoles(hospitalAdmin)).toContain("clinician");
    expect(assignableRoles({ roles: ["clinician"] })).toEqual([]);
  });

  it("keeps hospital admins inside their own hospital", () => {
    expect(canManageStaffMember(hospitalAdmin, { userId: "b", roles: ["clinician"], facilityId: "f1" })).toBe(true);
    expect(canManageStaffMember(hospitalAdmin, { userId: "b", roles: ["clinician"], facilityId: "f2" })).toBe(false);
  });

  it("stops admins managing themselves or system admins", () => {
    expect(canManageStaffMember(hospitalAdmin, { userId: "a", roles: ["clinician"], facilityId: "f1" })).toBe(false);
    expect(canManageStaffMember(hospitalAdmin, { userId: "s", roles: ["system_admin"], facilityId: null })).toBe(false);
  });

  it("lets the system admin manage hospital admins only", () => {
    expect(canManageStaffMember(systemAdmin, { userId: "b", roles: ["hospital_admin"], facilityId: "f1" })).toBe(true);
    expect(canManageStaffMember(systemAdmin, { userId: "b", roles: ["clinician"], facilityId: "f1" })).toBe(false);
  });

  it("scopes audit access", () => {
    expect(canViewAuditForFacility(systemAdmin, "f9")).toBe(true);
    expect(canViewAuditForFacility(hospitalAdmin, "f1")).toBe(true);
    expect(canViewAuditForFacility(hospitalAdmin, "f2")).toBe(false);
  });

  it("separates password and phone sign-in", () => {
    expect(signsInWithPassword(["clinician"])).toBe(true);
    expect(signsInWithPhone(["mother"])).toBe(true);
    expect(signsInWithPhone(["chv"])).toBe(true);
    expect(signsInWithPhone(["clinician"])).toBe(false);
  });
});
