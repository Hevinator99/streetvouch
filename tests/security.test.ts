import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, safeEqual, validManagerPassword } from "../lib/security";

test("manager passwords require length, letters and numbers",()=>{assert.equal(validManagerPassword("longpassword"),false);assert.equal(validManagerPassword("1234567890"),false);assert.equal(validManagerPassword("securepass1"),true);});
test("constant-shape string comparison rejects different values",()=>{assert.equal(safeEqual("abc","abc"),true);assert.equal(safeEqual("abc","abd"),false);assert.equal(safeEqual("abc","ab"),false);});
test("CSV export neutralises spreadsheet formulas and escapes quotes",()=>{assert.equal(csvCell("=IMPORTXML('x')"),'"\'=IMPORTXML(\'x\')"');assert.equal(csvCell('said "hello"'),'"said ""hello"""');});
