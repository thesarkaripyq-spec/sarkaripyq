// Run: npm run lighthouse (builds, starts a production server, audits,
// tears the server down). Requires .env.local to already be filled in
// (real Supabase credentials) - this audits real rendered pages, not
// mocked ones.
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30_000,
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/ssc",
        "http://localhost:3000/ssc/cgl",
        "http://localhost:3000/ssc/cgl/pyq",
        "http://localhost:3000/practice",
        "http://localhost:3000/books",
      ],
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
