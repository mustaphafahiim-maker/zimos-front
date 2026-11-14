import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PICTURE_RATIOS, pictureFocus, pictureRatio } from "./pictureFrame.ts";

describe("a picture's shape", () => {
  it("turns each named shape into its aspect-ratio", () => {
    assert.equal(pictureRatio("4:3"), "4 / 3");
    assert.equal(pictureRatio("1:1"), "1 / 1");
    assert.equal(pictureRatio("3:4"), "3 / 4");
    for (const name of Object.keys(PICTURE_RATIOS)) assert.match(pictureRatio(name), /^\d+ \/ \d+$/);
  });

  it("leaves a picture its own shape when none, or an unknown one, is stored", () => {
    for (const value of [undefined, null, "", "auto", "4/3", "5:7", 1.33, {}, "toString"]) {
      assert.equal(pictureRatio(value), null);
    }
  });
});

describe("the part of a picture kept in view", () => {
  it("is nothing at all for the centre, stored or not", () => {
    assert.equal(pictureFocus({}, false), null);
    assert.equal(pictureFocus({ focusX: "center", focusY: "center" }, true), null);
    assert.equal(pictureFocus({ focusX: "middle", focusY: 3 }, false), null);
  });

  it("names the edge up and down", () => {
    assert.equal(pictureFocus({ focusY: "top" }, false), "50% 0%");
    assert.equal(pictureFocus({ focusY: "bottom" }, false), "50% 100%");
  });

  it("follows the page's direction across", () => {
    assert.equal(pictureFocus({ focusX: "start" }, false), "0% 50%");
    assert.equal(pictureFocus({ focusX: "end" }, false), "100% 50%");
    assert.equal(pictureFocus({ focusX: "start" }, true), "100% 50%");
    assert.equal(pictureFocus({ focusX: "end", focusY: "top" }, true), "0% 0%");
  });
});
