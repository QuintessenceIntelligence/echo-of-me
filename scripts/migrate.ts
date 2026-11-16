import { migrate } from "../src/server/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
migrate(url)
  .then((applied) => console.log(applied.length ? `Applied:\n  ${applied.join("\n  ")}` : "Nothing to apply"))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
