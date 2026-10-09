import { lint } from "markdownlint/promise";
import config from "./config/markdownlint.json" with { type: "json" };

// This entry point owns only argv/output for markdownlint. It does not discover
// repository configuration, load custom rules, or invoke another lint engine.
const files = process.argv.slice(2);
if (files[0] === "--") files.shift();
if (files.length === 0 || files.some((file) => file.startsWith("-"))) {
  console.error("Usage: markdownlint <file.md> [file.md ...] (explicit file paths, no globs)");
  process.exitCode = 2;
} else {
  try {
    const results = await lint({ files, config, noInlineConfig: true });
    console.log(JSON.stringify(results, null, 2));
    process.exitCode = Object.values(results).some((errors) => errors.length > 0) ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
