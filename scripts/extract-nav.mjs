import fs from "fs";

const html = fs.readFileSync("AI Manager Schema ERD.html", "utf8");
const start = html.indexOf('"<!DOCTYPE html>');
let i = start + 1;
let escaped = false;
let raw = "";
while (i < html.length) {
  const c = html[i];
  if (escaped) {
    if (c === "n") raw += "\n";
    else if (c === "t") raw += "\t";
    else raw += c;
    escaped = false;
  } else if (c === "\\") escaped = true;
  else if (c === '"') break;
  else raw += c;
  i++;
}

const idx = raw.indexOf("navStyleFor");
console.log(raw.slice(idx, idx + 800).replace(/\s+/g, " "));
