import { describe, expect, test } from "bun:test";
import { FrontmatterError, parseFrontmatter } from "../src/frontmatter.ts";

describe("parseFrontmatter", () => {
	test("parses basic frontmatter", () => {
		const input = `---
title: Hello
version: 1
---
Body content here.`;
		const result = parseFrontmatter(input);
		expect(result.frontmatter.title).toBe("Hello");
		expect(result.frontmatter.version).toBe(1);
		expect(result.body).toBe("Body content here.");
	});

	test("returns empty frontmatter when no --- delimiter", () => {
		const input = "Just a body with no frontmatter.";
		const result = parseFrontmatter(input);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe(input);
	});

	test("returns body unchanged when no closing ---", () => {
		const input = `---
title: Hello
No closing delimiter`;
		const result = parseFrontmatter(input);
		expect(result.body).toBe(input);
	});

	test("normalizes kebab-case keys to camelCase", () => {
		const input = `---
thinking-level: high
max-tokens: 4096
---
Body`;
		const result = parseFrontmatter(input);
		expect(result.frontmatter.thinkingLevel).toBe("high");
		expect(result.frontmatter.maxTokens).toBe(4096);
	});

	test("strips HTML comments", () => {
		const input = `<!-- comment -->---
title: Hello
---
Body <!-- inline --> here.`;
		const result = parseFrontmatter(input);
		expect(result.frontmatter.title).toBe("Hello");
		expect(result.body).toBe("Body  here.");
	});

	test("normalizes CRLF to LF", () => {
		const input = "---\r\ntitle: Hello\r\n---\r\nBody";
		const result = parseFrontmatter(input);
		expect(result.frontmatter.title).toBe("Hello");
		expect(result.body).toBe("Body");
	});

	test("merges with fallback values", () => {
		const input = `---
title: Hello
---
Body`;
		const result = parseFrontmatter(input, {
			fallback: { version: 1, title: "default" },
		});
		expect(result.frontmatter.title).toBe("Hello");
		expect(result.frontmatter.version).toBe(1);
	});

	test("normalize=false skips HTML comment stripping and CRLF", () => {
		const input = `---
title: Hello
---
Body <!-- here -->`;
		const result = parseFrontmatter(input, { normalize: false });
		expect(result.body).toBe("Body <!-- here -->");
	});

	test("level=fatal throws on invalid YAML", () => {
		const input = `---
*undefined_alias
---
Body`;
		expect(() => parseFrontmatter(input, { level: "fatal" })).toThrow(FrontmatterError);
	});

	test("level=warn falls back to simple parsing on invalid YAML", () => {
		const input = `---
title: Hello
nested: [invalid
---
Body`;
		const result = parseFrontmatter(input, { level: "warn" });
		expect(result.frontmatter.title).toBe("Hello");
		expect(result.body).toBe("Body");
	});

	test("handles empty frontmatter block", () => {
		const input = `---
---
Body`;
		const result = parseFrontmatter(input);
		expect(result.body).toBe("Body");
	});

	test("handles complex YAML values", () => {
		const input = `---
tags:
  - one
  - two
nested:
  key: value
---
Body`;
		const result = parseFrontmatter(input);
		expect(result.frontmatter.tags).toEqual(["one", "two"]);
		expect(result.frontmatter.nested).toEqual({ key: "value" });
	});

	test("normalizes nested kebab-case keys", () => {
		const input = `---
top-level:
  inner-key: value
---
Body`;
		const result = parseFrontmatter(input);
		expect(result.frontmatter.topLevel).toEqual({ innerKey: "value" });
	});
});

describe("FrontmatterError", () => {
	test("has correct name and message", () => {
		const cause = new Error("bad yaml");
		const err = new FrontmatterError(cause, "test.md");
		expect(err.name).toBe("FrontmatterError");
		expect(err.message).toContain("bad yaml");
		expect(err.message).toContain("test.md");
		expect(err.source).toBe("test.md");
		expect(err.cause).toBe(cause);
	});
});
