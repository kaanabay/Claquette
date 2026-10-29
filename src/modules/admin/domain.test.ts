import { describe, expect, it } from "vitest";
import { isListedAdmin, parseSiteAdmins, temporaryPassword } from "./domain";

describe("site admins", () => {
  it("reads a comma separated list of usernames, ignoring case and spaces", () => {
    const admins = parseSiteAdmins(" kaan , Ayse,,");
    expect([...admins]).toEqual(["kaan", "ayse"]);
    expect(isListedAdmin("Kaan", admins)).toBe(true);
    expect(isListedAdmin("deniz", admins)).toBe(false);
    expect(isListedAdmin(null, admins)).toBe(false);
  });

  it("has nobody when the setting is missing", () => {
    expect(parseSiteAdmins(undefined).size).toBe(0);
    expect(parseSiteAdmins("").size).toBe(0);
  });
});

describe("temporaryPassword", () => {
  it("is three words and a two-digit number, long enough to sign in with", () => {
    const password = temporaryPassword(() => 0);
    expect(password).toBe("ada-ada-ada-10");
    expect(temporaryPassword((max) => max - 1)).toMatch(/^[a-z]+-[a-z]+-[a-z]+-99$/);
    expect(password.length).toBeGreaterThanOrEqual(8);
  });
});
