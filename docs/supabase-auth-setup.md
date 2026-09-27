# Supabase auth production setup

The app uses these flows:

- Create account: email only -> confirmation email -> `/auth/callback?flow=signup` -> set password -> dashboard.
- Sign in: email and password -> dashboard. It never creates an account or sends a link.
- Forgot password: reset email -> `/auth/callback?flow=recovery` -> set password -> dashboard.
- Google: Google Identity Services token -> `/auth/callback?source=google` -> onboarding.

## 1. URL configuration

In Supabase Dashboard, open **Authentication -> URL Configuration**.

Set **Site URL** to:

```text
https://getoverdue.online
```

Add every production callback below to **Redirect URLs**:

```text
https://getoverdue.online/auth/callback
https://getoverdue.online/auth/callback?flow=signup
https://getoverdue.online/auth/callback?flow=recovery
https://getoverdue.online/auth/callback?source=google
```

For local development, also add:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?flow=signup
http://localhost:3000/auth/callback?flow=recovery
http://localhost:3000/auth/callback?source=google
http://127.0.0.1:3000/auth/callback
http://127.0.0.1:3000/auth/callback?flow=signup
http://127.0.0.1:3000/auth/callback?flow=recovery
http://127.0.0.1:3000/auth/callback?source=google
```

In Vercel Production environment variables, set:

```text
NEXT_PUBLIC_APP_URL=https://getoverdue.online
```

Redeploy after changing a `NEXT_PUBLIC_*` value. Do not set the production value to `localhost`.

## 2. Confirmation email

In **Authentication -> Email Templates -> Confirm signup**, use:

**Subject**

```text
Set your password for Overdue
```

**Body (HTML)**

```html
<div style="margin:0 auto;max-width:560px;padding:32px 20px;font-family:Arial,sans-serif;color:#24251f;line-height:1.6">
  <h1 style="font-size:24px;margin:0 0 16px">Finish creating your Overdue account</h1>
  <p>We received a request to create an Overdue account for {{ .Email }}.</p>
  <p>Confirm your email and choose your password using the button below.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;border-radius:6px;background:#304f3d;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600">Confirm email and set password</a>
  </p>
  <p style="font-size:13px;color:#66685f">If the button does not work, open this link:</p>
  <p style="font-size:13px;word-break:break-all"><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>
  <p style="font-size:13px;color:#66685f">If you did not request this account, you can ignore this email.</p>
</div>
```

Use `{{ .ConfirmationURL }}`, not `{{ .SiteURL }}`. The confirmation URL retains the signup callback and one-time auth code. A template linked only to `SiteURL` sends users to `/` and causes the error/sign-in behavior this flow is designed to avoid.

## 3. Password recovery email

In **Authentication -> Email Templates -> Reset password**, use:

**Subject**

```text
Reset your Overdue password
```

**Body (HTML)**

```html
<div style="margin:0 auto;max-width:560px;padding:32px 20px;font-family:Arial,sans-serif;color:#24251f;line-height:1.6">
  <h1 style="font-size:24px;margin:0 0 16px">Reset your Overdue password</h1>
  <p>We received a password reset request for {{ .Email }}.</p>
  <p>Use the secure link below to choose a new password.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;border-radius:6px;background:#304f3d;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600">Choose a new password</a>
  </p>
  <p style="font-size:13px;color:#66685f">If the button does not work, open this link:</p>
  <p style="font-size:13px;word-break:break-all"><a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>
  <p style="font-size:13px;color:#66685f">If you did not request a reset, ignore this email. Your password will not change.</p>
</div>
```

## 4. Keep auth mail out of spam

Supabase's shared test mailer is not suitable for production delivery. Configure custom SMTP in **Project Settings -> Authentication -> SMTP Settings**.

For Resend:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: <RESEND_API_KEY>
Sender name: Overdue
Sender email: auth@getoverdue.online
```

Before using that sender:

1. Verify `getoverdue.online` (or a dedicated auth subdomain) in Resend.
2. Add the exact SPF and DKIM records supplied by Resend to DNS.
3. Add a DMARC TXT record. Start with monitoring, for example `v=DMARC1; p=none; adkim=r; aspf=r`, then tighten the policy after delivery is healthy.
4. Make sure only one SPF TXT record exists for the sending hostname; merge providers into one record instead of creating duplicates.
5. Send tests to Gmail and Outlook, confirm SPF/DKIM/DMARC pass in the message headers, and mark the first test as "Not spam" if needed.

Email copy alone cannot guarantee inbox placement. A verified domain, aligned SPF/DKIM/DMARC, custom SMTP, low complaint rates, and a consistent sender are the material fixes.

## 5. Verification checklist

1. Open `/signup` in a private window and submit a new address.
2. Confirm a row appears in **Authentication -> Users** immediately.
3. Open the confirmation email in the same browser.
4. Confirm the URL first reaches `/auth/callback?flow=signup...`, then `/auth/set-password?flow=signup`.
5. Enter a password with at least 10 characters, one uppercase letter, and one number.
6. Confirm the browser lands on `/dashboard` and a refresh remains signed in.
7. Sign out, use **Forgot your password?**, and repeat the recovery flow.

Vercel Analytics route counts are page views, not auth conversions. This app uses `/login`, not `/signin`, so a `/signin` count of zero is expected. Supabase **Authentication -> Users** is the source of truth for created accounts.
