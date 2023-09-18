import fs from "fs";
import { Buffer } from "buffer";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";

async function main() {
  const block217833460 = fs.readFileSync("data/217833460.json", "utf-8");
  console.log(block217833460.slice(0, 100));

  const original = block217833460;

  const originalU8 = strToU8(original);

  const zippedU8 = gzipSync(originalU8);
  const unzippedU8 = gunzipSync(zippedU8);

  const recovered = strFromU8(unzippedU8);

  console.log("orginal size:", Math.floor(original.length / 1024), "KB");
  console.log("orginal size:", Math.floor(originalU8.length / 1024), "KB");
  console.log("zipped size:", Math.floor(zippedU8.length / 1024), "KB");
  console.log("unzipped size:", Math.floor(unzippedU8.length / 1024), "KB");
  console.log("recovered size:", Math.floor(recovered.length / 1024), "KB");
  console.log("match", original === recovered);  
}

main();