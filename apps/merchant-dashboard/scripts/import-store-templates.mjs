// Adds the store templates of src/pages/website/templates/generated/console/
// to the platform console: a dry run by default, which sends nothing; --apply
// to send. The work is in templateImport.mjs; the commands are in README.md.
import { main } from "./templateImport.mjs";

process.exitCode = await main(process.argv.slice(2));
