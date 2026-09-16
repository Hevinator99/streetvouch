import test from "node:test";
import assert from "node:assert/strict";
import { classifyFeedbackSeverity, csvCell, safeEqual, validManagerPassword } from "../lib/security";

test("manager passwords require length, letters and numbers",()=>{assert.equal(validManagerPassword("longpassword"),false);assert.equal(validManagerPassword("1234567890"),false);assert.equal(validManagerPassword("securepass1"),true);});
test("constant-shape string comparison rejects different values",()=>{assert.equal(safeEqual("abc","abc"),true);assert.equal(safeEqual("abc","abd"),false);assert.equal(safeEqual("abc","ab"),false);});
test("CSV export neutralises spreadsheet formulas and escapes quotes",()=>{assert.equal(csvCell("=IMPORTXML('x')"),'"\'=IMPORTXML(\'x\')"');assert.equal(csvCell('said "hello"'),'"said ""hello"""');});
test("feedback severity flags urgent language without flagging ordinary praise",()=>{assert.equal(classifyFeedbackSeverity("The service was excellent"),"normal");assert.equal(classifyFeedbackSeverity("I want a refund after a rude visit"),"attention");assert.equal(classifyFeedbackSeverity("I felt unsafe and threatened"),"serious");});
