import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answersToInput,
  charCount,
  fieldLabel,
  fieldLimit,
  serverFieldProblems,
  validateAnswers,
} from "./customFields.ts";

const FIELDS = [
  { id: "name", type: "text", label: { ar: "الاسم", en: "Name" }, required: true, maxLength: 5 },
  { id: "note", type: "textarea", label: { en: "Note" } },
  { id: "photo", type: "image", label: { ar: "صورة" }, required: true },
];

describe("custom fields on the product page", () => {
  it("labels in the store's language, falling back to the other", () => {
    assert.equal(fieldLabel(FIELDS[0], "ar"), "الاسم");
    assert.equal(fieldLabel(FIELDS[1], "ar"), "Note");
    assert.equal(fieldLabel(FIELDS[2], "en"), "صورة");
  });

  it("knows each field's limit", () => {
    assert.equal(fieldLimit(FIELDS[0]), 5);
    assert.equal(fieldLimit(FIELDS[1]), 500);
    assert.equal(fieldLimit({ id: "x", type: "text", label: {}, maxLength: 999 }), 200);
    assert.equal(charCount("👋🏽a"), 3);
  });

  it("flags what is missing, too long or still uploading", () => {
    assert.deepEqual(validateAnswers(FIELDS, {}), { name: "required", photo: "required" });
    assert.deepEqual(validateAnswers(FIELDS, { name: "Sara Ali", photo: "u1" }), { name: "tooLong" });
    assert.deepEqual(validateAnswers(FIELDS, { name: "Sara" }, new Set(["photo"])), { photo: "uploading" });
    assert.deepEqual(validateAnswers(FIELDS, { name: " Sara ", photo: "u1" }), {});
  });

  it("sends trimmed answers and leaves empty ones out", () => {
    assert.deepEqual(answersToInput(FIELDS, { name: " Sara ", note: "  ", photo: "u1" }), { name: "Sara", photo: "u1" });
    assert.equal(answersToInput(FIELDS, {}), undefined);
  });

  it("reads the server's problems per field", () => {
    assert.deepEqual(
      serverFieldProblems([
        { field: "customizations.name", code: "REQUIRED" },
        { field: "customizations.photo", code: "UPLOAD_INVALID" },
        { field: "contact.phone", code: "X" },
      ]),
      { name: "required", photo: "expired" }
    );
  });
});
