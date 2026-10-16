# Bookkeeping product prototype

Open `index.html` directly, or run from the repo root:

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory prototypes/bookkeeping
```

Visit http://127.0.0.1:8767/. All six pages work without JavaScript, analytics, accounts, external assets or the production app. Comparison views are ordinary links, and each profile links to primary sources. The prototype is marked noindex and is not wired into production routes.

Edit `products.json`, then run:

```sh
python3 prototypes/bookkeeping/build.py
```

Commit the JSON, renderer and regenerated HTML together. Each material fact has a source ID. `checked_at` means a human/agent actually inspected the sources on that date; rebuilding does not refresh it. Fit statements and questions are editorial judgments. Pricing is a dated snapshot, not a quote.

This is a three-tool research pilot, not the proposed 6–10-tool MVP. Ledger retention is a coarse filter, not a guarantee that every feature works on the selected ledger. Country, plan and feature availability must be checked separately.

See [research findings and usability protocol](../../docs/product/2026-10-16-bookkeeping-prototype.md). Do not confuse browser QA with testing the product with actual users.
