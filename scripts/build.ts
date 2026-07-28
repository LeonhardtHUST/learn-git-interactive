import solidPlugin from "@opentui/solid/bun-plugin";

const outfile = Bun.argv[2] ?? "./dist/learn-git-interactive";
const result = await Bun.build({
  entrypoints: ["./src/compiled_entry.ts"],
  target: "bun",
  plugins: [solidPlugin],
  compile: { outfile },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
