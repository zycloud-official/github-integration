// Intentionally empty — global beforeEach/afterEach hooks in Vitest's setupFiles
// run at unpredictable times relative to test-file-level hooks, causing flaky DB
// state. Cleanup is handled per-file via the cleanDb() helper in helpers.js.
