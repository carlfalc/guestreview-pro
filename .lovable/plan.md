# Remove the "Lovable" branding from Google sign-in

Right now Google sign-in uses Lovable's managed OAuth credentials. That means the Google consent screen shows Lovable's app name and a generic callback domain instead of GuestReview Pro. This is a configuration change, not an app-code change — nothing in the sign-in code needs to be rewritten.

## What to change

Swap the managed Google credentials for your own Google Cloud OAuth client, so the consent screen reads "GuestReview Pro" with your logo and your domain.

Steps (you do these, I can't do them for you):

1. In Google Cloud Console, configure the OAuth consent screen:
   - App name: GuestReview Pro
   - Support email + logo
   - Authorised domains: `googlereviewpro.com`, `guestreviewpro.com`
   - Scopes: `openid`, `userinfo.email`, `userinfo.profile`
2. Create an OAuth client ID (type: Web application).
3. Paste the callback URL shown in the backend auth settings (Users → Authentication Settings → Sign In Methods → Google) into "Authorised redirect URIs".
4. Copy the client ID and secret back into that same Google provider panel and save.

## Reducing the callback domain reference

The redirect URI itself still shows the backend auth host during the round trip. To make that read as your own brand, a custom auth domain (e.g. `auth.googlereviewpro.com`) has to be pointed at the auth service via DNS. That is optional — most users never see it, since it flashes for under a second.

## Code impact

None. `src/routes/auth.tsx` keeps calling `lovable.auth.signInWithOAuth("google", ...)`; the provider swap is purely credential configuration. Email/password sign-up already shows no Lovable branding.

If you also see a Lovable badge on the published site itself, that is a separate publish setting I can turn off — say the word and I'll include it.
