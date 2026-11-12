import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const source = resolve("public/icons/icon-512.svg");
const svg = await readFile(source);
const outputs = [
  ["public/icons/apple-touch-icon.png", 180],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
];

await Promise.all(outputs.map(async ([file, size]) => {
  const destination = resolve(file);
  await mkdir(dirname(destination), { recursive: true });
  await sharp(svg, { density: 144 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destination);
}));

console.log("Generated Haddir PWA PNG icons:", outputs.map(([file]) => file).join(", "));
