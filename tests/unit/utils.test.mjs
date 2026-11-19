import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePhone,
  normalizeSudanesePhone,
  isValidSudanesePhone,
} from "../lib/utils/phone.ts";

import {
  isValidDate,
  formatDate,
  formatDateTime,
} from "../lib/utils/dates.ts";

test("normalizePhone converts Arabic-Indic digits to ASCII", () => {
  assert.equal(normalizePhone("٠٩١٢٣٤٥٦٧٨"), "0912345678");
});

test("normalizePhone removes spaces and common separators", () => {
  assert.equal(normalizePhone("091 234-5678"), "0912345678");
  assert.equal(normalizePhone("(091) 234-5678"), "0912345678");
});

test("normalizeSudanesePhone uses the shared normalization", () => {
  assert.equal(normalizeSudanesePhone("٠٩١-٢٣٤-٥٦٧٨"), "0912345678");
});

test("isValidSudanesePhone accepts a ten-digit number starting with zero", () => {
  assert.equal(isValidSudanesePhone("0912345678"), true);
  assert.equal(isValidSudanesePhone("٠٩١٢٣٤٥٦٧٨"), true);
});

test("isValidSudanesePhone rejects invalid lengths and prefixes", () => {
  for (const value of ["912345678", "091234567", "09123456789", "+249912345678", "abcdefghij", ""]) {
    assert.equal(isValidSudanesePhone(value), false, `Expected ${value} to be rejected`);
  }
});

test("isValidDate accepts valid strings and Date instances", () => {
  assert.equal(isValidDate("2026-11-20T12:00:00.000Z"), true);
  assert.equal(isValidDate(new Date("2026-11-20T12:00:00.000Z")), true);
});

test("isValidDate rejects invalid strings and Date instances", () => {
  assert.equal(isValidDate("not-a-date"), false);
  assert.equal(isValidDate(new Date(Number.NaN)), false);
});

test("formatDate returns an em dash for invalid input", () => {
  assert.equal(formatDate("not-a-date"), "—");
});

test("formatDate formats valid input", () => {
  const result = formatDate("2026-11-20T12:00:00.000Z");
  assert.ok(result.length > 0);
  assert.notEqual(result, "—");
});

test("formatDateTime formats valid date-time input", () => {
  const result = formatDateTime("2026-11-20T12:00:00.000Z");
  assert.ok(result.length > 0);
  assert.notEqual(result, "—");
});
