# DinWin 🍽️

A responsive dinner decider for London. Guests choose their favourite cuisines; the app identifies unanimous favourites or the closest compromise, then finds matching restaurants near a London postcode or neighbourhood.

## Deploy with Netlify

1. In Netlify connect GitHub repository `desdodec/din_win`, choosing `main`.
2. Use the default deploy settings; `netlify.toml` sets the publish directory and functions.
3. Sign up for a free Geoapify account at https://myprojects.geoapify.com/ and copy its API key.
4. Under **Netlify → Project configuration → Environment variables** add key `GEOAPIFY_API_KEY` and paste the Geoapify key as its value. Give it Functions scope (or All scopes).
5. Trigger a new production deployment in **Deploys**. Open https://dinnerwinner.netlify.app/ and test `Soho`.

No Google API key, Google billing or .env file is needed. You can remove `GOOGLE_PLACES_API_KEY` from Netlify.

## What the data can and cannot do

Restaurant results are fetched from Geoapify Places (based largely on OpenStreetMap data). The server first geocodes the London area or postcode, then searches for cuisine-tagged restaurants within 2.5 km. Results are ordered by matching cuisine count, then proximity. Phone numbers and restaurant websites appear when the dataset has them; Google Maps links let guests inspect ratings and reviews separately. Geoapify **does not supply verified Google star ratings or consistent £ price levels**, so DinWin doesn't fabricate them.

Cuisines that lack detailed classifications in the source data may return fewer results. The 3,000-requests/day free allowance is shared across Geoapify endpoints; each dinner search typically uses two requests. For public use consider API quotas, abuse prevention, and caching. Keep the API key in Netlify Functions; do not commit it to GitHub.

## MVP scope

This is same-device voting, with selections saved locally in the browser. For separate-device group invitations, shared server-side sessions would be the next feature.
