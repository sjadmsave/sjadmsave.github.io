# APK Studio Cloud — Public Information Website

A static, Arabic-first informational website for the APK Studio Cloud Android app.

## Publish using GitHub Pages

1. Create a **PUBLIC** repository named `sjadmsave.github.io` under the GitHub account `sjadmsave`. Keep your actual app-source repository private.
2. Upload all website files from this archive into the repository root (not an enclosing folder). Never upload source archives, private keystores (`.p12`), signing passwords, Android build credentials, or Google OAuth tokens.
3. Open **Settings → Pages → Build and deployment**; select **Deploy from a branch**, branch `main`, folder `/(root)`, then **Save**.
4. Wait for publication. Check:
   - https://sjadmsave.github.io/
   - https://sjadmsave.github.io/privacy.html
   - https://sjadmsave.github.io/terms.html
5. Enter these exact HTTPS URLs into **Google Auth Platform → Branding** only once they are actually live.
6. **IMPORTANT:** Google may require proof that you own your app's top private domain for OAuth production branding. A shared `github.io` domain may not meet this requirement. Do not claim that a GitHub Pages link guarantees Google approval; if domain verification rejects this setup, register or control a verifiable custom domain and set it up for GitHub Pages.

## Website details

No JavaScript, no tracking pixels, no web sign-in, no analytics libraries, and no sensitive materials. Content should be kept in sync with changes to Android app privacy practices. Written for build 1.7.0 (Oct 2026).

## Maintenance

Edit `index.html`, `privacy.html`, `terms.html`, and `style.css` as needed. Never include private GitHub repository paths, keystore data, or user backup archives in this public repository.