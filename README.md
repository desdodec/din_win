# DinWin 🍽️

A responsive group dinner decider for London. Each guest selects any number of preferred cuisines, and DinWin identifies unanimous choices or suggests a majority-led compromise. Search a London area or postcode to see highly rated restaurant recommendations, price band, address, phone number, website and directions.

## Deploy to Netlify

1. In Netlify, choose **Add new project → Import an existing project** and connect `desdodec/din_win`.
2. Use the repository default settings (publish directory `.`; no build command). The included `netlify.toml` configures serverless functions.
3. In Google Cloud Console, create/select a project, enable **Places API (New)** and enable billing. Create an API key for this API.
4. In Netlify → **Project configuration → Environment variables**, add `GOOGLE_PLACES_API_KEY` with your key as the value. Redeploy.
5. Open the Netlify URL. The serverless function keeps your key out of the browser.

**Important:** Restrict the Google API key to Places API (New). Because requests are made from a serverless function, do not apply browser HTTP referrer restrictions. Consider a cloud budget/quotas, bot protection, and server-side rate limiting before public promotion. Every search calls Google Places once per selected cuisine (maximum 5). Google may charge for the requested fields. Google Places data availability varies: some results have no phone, website, price band or rating.

## Local development

Install the Netlify CLI (`npm install -g netlify-cli`), set `GOOGLE_PLACES_API_KEY` in a local `.env` file, and run `netlify dev`. Open the URL shown by the CLI. Never commit `.env`.

## Behaviour

- Starts with three guests; add up to 50.
- Select multiple cuisines per guest, with automatic local saving in that browser.
- Shows cuisines selected by everyone; if no unanimous overlap, shows up to five cuisines with the highest vote counts and vote fractions.
- Searches those top five cuisines, merges duplicate Google Places results, then ranks by rating, review count and how many searched cuisines matched.
- No login or database is required. **This is a shared-screen voting MVP**: each person votes on the same device. Separate-device voting via shareable links would require session storage/server infrastructure.
- Restaurant information is provided by **Google Places**, not a manually curated list. Price level is displayed as £–££££ when available, not an exact per-person bill.

## Files

- `index.html` — fully self-contained responsive app.
- `netlify/functions/restaurants.mjs` — secure restaurant search proxy.
- `netlify.toml` — deployment settings.

## Notes

Google Places Text Search is a relevance search, not a strict geographical boundary. Always inspect the address for the target area; results may extend beyond a specified postcode. Further improvements could include radius filtering, location geocoding, shareable invitations, budget preferences and hard dietary constraints.
