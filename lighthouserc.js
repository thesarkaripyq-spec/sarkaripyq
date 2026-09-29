// Run: npm run lighthouse (builds, starts a production server, audits,
// tears the server down). Requires .env.local to already be filled in
// (real Supabase credentials) - this audits real rendered pages, not
// mocked ones. Override the port with LHCI_PORT=<port> if 3000 is
// already in use (e.g. a dev server running locally).
const port = process.env.LHCI_PORT ?? "3000";
const base = `http://localhost:${port}`;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `cross-env PORT=${port} npm run start`,
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30_000,
      url: [`${base}/`, `${base}/ssc`, `${base}/ssc/cgl`, `${base}/ssc/cgl/pyq`, `${base}/practice`, `${base}/books`],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
          disabled: false,
        },
        throttlingMethod: "simulate",
        // Matches Lighthouse's own default mobile ("Moto G Power on
        // slow 4G") throttling profile - not loosened.
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
