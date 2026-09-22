import test from "node:test";
import assert from "node:assert/strict";
import { classifyComment } from "../lib/weekly-report";
test("dashboard classifies the supplied customer examples without losing negation",()=>{
 for(const [text,tone] of [["Good haircut","positive"],["Nice people","positive"],["Not bad","positive"],["Won’t be returning","negative"],["Joe was rude, although the haircut was okay","mixed"],["Not sure about the haircut","mixed"],["Terrible cut","negative"],["Jordan was lovely","positive"],["Not good","negative"]])assert.equal(classifyComment(text).sentiment,tone,text);
});
