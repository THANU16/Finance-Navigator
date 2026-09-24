import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(dir, "..", "api-zod", "src", "index.ts");

writeFileSync(target, 'export * from "./generated/api";\n');
