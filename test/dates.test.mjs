import { test } from "node:test";
import assert from "node:assert/strict";
import { schoolExpiryDate } from "../src/dates.ts";

test("school validity displays the final valid Korean date without time", () => {
  assert.equal(schoolExpiryDate("2027-02-28T15:00:00.000Z"), "2027년 2월 28일");
  assert.equal(schoolExpiryDate("2026-08-31T15:00:00.000Z"), "2026년 8월 31일");
  assert.equal(schoolExpiryDate("2028-02-29T15:00:00.000Z"), "2028년 2월 29일");
  assert.equal(schoolExpiryDate("invalid"), "확인 필요");
});
