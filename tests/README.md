# Tests Overview

This folder contains unit and integration tests for Ariadne's parsing, graph, and tool behavior.

## One-Line Purpose Per Test File

- `tests/languages/typescript.test.ts`: Verifies the TypeScript tree-sitter parser extracts expected symbols and edges from a small fixture.
- `tests/languages/javascript.test.ts`: Verifies the JavaScript tree-sitter parser extracts expected symbols and edges from a small fixture.
- `tests/languages/python.test.ts`: Verifies the Python tree-sitter parser extracts expected symbols and edges from a small fixture.
- `tests/graph/queries.test.ts`: Verifies core `graph/queries.ts` read APIs against seeded in-memory SQLite data.
- `tests/integration/ariadne.test.ts`: Verifies end-to-end SCIP load into DB and validates tool handler responses on a tiny synthetic repo.
- `tests/integration/mcp-stdio.test.ts`: Verifies the real MCP stdio transport by spawning the server and calling tools through an MCP client.
- `tests/integration/tool-errors.test.ts`: Verifies tool handlers return clear, user-friendly messages on empty/missing data paths.

## Fixtures

- `tests/fixtures/typescript-sample.ts`: Minimal TypeScript source used by parser unit tests.
- `tests/fixtures/javascript-sample.js`: Minimal JavaScript source used by parser unit tests.
- `tests/fixtures/python-sample.py`: Minimal Python source used by parser unit tests.

## Run

- Full suite: `npm test`
- Build check: `npm run build`
