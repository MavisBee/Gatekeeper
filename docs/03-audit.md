# Security Audit: The Gatekeeper

Six vulnerabilities found. Each section explains the problem, shows the exact lines, and then teaches you how to fix it.

---

## Issue 1: Timing Attack on Email Lookups

### The Problem

Look at the login flow in `app/actions/auth.ts:92-115`:

```ts
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
});

if (!user) {
  return { success: false, errors: { global: 'Invalid email or password.' } };
}

const passwordMatch = await bcrypt.compare(password, user.password);
if (!passwordMatch) {
  return { success: false, errors: { global: 'Invalid email or password.' } };
}
```

There are **two different return paths**, and they take different amounts of time:

| Path | What happens | Approximate time |
|---|---|---|
| Email doesn't exist | DB lookup → immediate return | ~2 ms |
| Email exists, wrong password | DB lookup → bcrypt.compare (~100ms) → return | ~102 ms |

An attacker can measure response times. Emails that take ~102 ms to respond **must exist** in the database. Emails that take ~2 ms don't. This is called a **timing side-channel** — the application leaks information through how long it takes to answer.

Even though the error message is the same ("Invalid email or password."), the response time betrays which emails are real.

### The Fix

**Always run bcrypt.compare**, even when the user isn't found. Use a dummy hash so both paths take the same amount of time:

```ts
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
});

// If no user found, use a dummy hash so the bcrypt.compare
// still runs and both paths take the same amount of time.
// This eliminates the timing side-channel.
const userPassword = user?.password ?? '$2a$10$' + '0'.repeat(53);
const passwordMatch = await bcrypt.compare(password, userPassword);

if (!user || !passwordMatch) {
  return {
    success: false,
    errors: { global: 'Invalid email or password.' },
  };
}
```

**Why this works:** `bcrypt.compare('any_password', '$2a$10$000...')` takes the same ~100 ms as comparing against a real hash. An attacker can no longer distinguish "email not found" from "wrong password" by measuring response time.

The dummy value `'$2a$10$' + '0'.repeat(53)` is a valid bcrypt hash format (salt `$2a$10$` followed by 53 characters of zeros), so bcrypt won't throw an error — it will just compute and return `false`.

---

## Issue 2: Weak Cookie Flags

### The Problem

Look at `lib/session.ts:43-49`:

```ts
cookieStore.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

There are two weaknesses:

**Weakness A — `secure` is off in development (`lib/session.ts:45`):**
```ts
secure: process.env.NODE_ENV === 'production',
```
When running locally (`NODE_ENV` is not `'production'`), `secure` is `false`. The cookie is sent over plain HTTP. If the dev server is accessed over a local network (e.g., `192.168.1.50:3000`), anyone on that Wi-Fi network can sniff the session cookie out of the air.

**Weakness B — No `__Host-` cookie name prefix (`lib/session.ts:43`):**
```ts
cookieStore.set('session', token, ...)
```
The cookie is named `session`. A `__Host-` prefixed cookie (like `__Host-session`) tells the browser to enforce two extra rules automatically: the cookie must have `secure: true` and must not have a `domain` attribute. This prevents a subdomain from overwriting or reading the cookie.

### The Fix

Make two changes to `lib/session.ts:43-49`:

```ts
cookieStore.set('__Host-session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

And update the read in `getSession()` (`lib/session.ts:35`) and `deleteSession()` (`lib/session.ts:54`):

```ts
// line 35
const token = cookieStore.get('__Host-session')?.value;

// line 54
cookieStore.delete('__Host-session');
```

Also update `proxy.ts:15`:

```ts
const cookie = request.cookies.get('__Host-session')?.value;
```

**Why `secure: true` always works, even in dev:**
- Modern browsers treat `localhost` as a secure origin. The `Secure` flag works on `localhost` even without TLS.
- For `__Host-` to work, `secure` must be `true`.
- For production it's correct anyway.

**Why `__Host-` helps:**
- `__Host-session` automatically requires `secure: true`, `path: /`, and no `domain`. This prevents a compromised subdomain like `evil.gatekeeper.com` from reading or overwriting the parent domain's session cookie.

---

## Issue 3: Missing CSRF Protection

### The Problem

Look at the login page form in `app/login/page.tsx:49`:

```tsx
<form onSubmit={handleSubmit} className="space-y-5">
```

And the signup form at `app/signup/page.tsx:51`:

```tsx
<form onSubmit={handleSubmit} className="space-y-5">
```

Both forms use plain `onSubmit` handlers that call server actions. There are no CSRF tokens anywhere. A **Cross-Site Request Forgery** (CSRF) attack works like this:

1. A bad guy builds a fake website at `evil.com`
2. The fake website has a hidden form or script that submits to `gatekeeper.com/login` with the victim's known email and a guessed password
3. If the victim is browsing both sites, the browser includes the victim's cookies with the request
4. The server sees a valid session cookie and a valid POST — it logs the victim out (or, if the bad guy guessed the password, creates a new session)

While Next.js server actions do check the `Origin` header, this check is not foolproof. Older browsers don't send `Origin`, and extensions can suppress it. Defense in depth means you shouldn't rely on a single CSRF check.

### The Fix

**Option A: Switch cookies to `SameSite=Strict`** (`lib/session.ts:46`):

```ts
sameSite: 'strict',
```

**What this changes:** `SameSite=Lax` allows cookies to be sent when the user clicks a link from an external site. `SameSite=Strict` only sends the cookie when the user is directly on your site. This blocks CSRF at the browser level — the bad guy's fake form won't include the session cookie.

**Trade-off:** If a user clicks a link to `/dashboard` from their email, they won't be logged in immediately. They'd need to visit `/login` first. For most apps this is acceptable.

**Option B: Add an explicit CSRF token (belt-and-suspenders):**

Create a simple CSRF utility. The server action reads a custom header that the client-side page must set:

```ts
// lib/csrf.ts
import { cookies } from 'next/headers';

export async function getCsrfToken() {
  const cookieStore = await cookies();
  const token = crypto.randomUUID();
  cookieStore.set('csrf-token', token, {
    httpOnly: false,  // must be readable by JS
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
  return token;
}

export async function validateCsrfToken(headerToken: string) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('csrf-token')?.value;
  return cookieToken === headerToken;
}
```

Then in the server action, check:

```ts
// When logging in, inside logInAction:
const csrfHeader = headers().get('x-csrf-token');
if (!csrfHeader || !(await validateCsrfToken(csrfHeader))) {
  return { success: false, errors: { global: 'Invalid request.' } };
}
```

And on the client page, send the token as a header. But for this codebase, **switching to `SameSite=Strict`** is the simplest fix that gives the most protection.

---

## Issue 4: JWT Signing Key Exposure

### The Problem

Look at `lib/session.ts:4-6`:

```ts
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev_secret_key_must_be_long_and_secure_minimum_32_characters'
);
```

And the `.env` file:

```
DATABASE_URL="file:./dev.db"
```

There are **two problems** here:

**Problem A — Hardcoded fallback secret in source code (`lib/session.ts:5`):**
```ts
process.env.JWT_SECRET || 'dev_secret_key_must_be_long_and_secure_minimum_32_characters'
```

The string `'dev_secret_key_must_be_long_and_secure_minimum_32_characters'` is checked into source control. Anyone who reads the code knows the signing key. They can forge JWTs that say `{ userId: 'any-id', email: 'admin@site.com', name: 'Admin' }` and the server will accept them because it's signed with the same key.

**Problem B — No `JWT_SECRET` in `.env` (`lib/session.ts:5`):**
The fallback is actively being used because `.env` only defines `DATABASE_URL`. There is no `JWT_SECRET` environment variable anywhere. The application is running in production with a signing key that's literally written in the source code.

**Problem C — Module-scoped constant (`lib/session.ts:4`):**
```ts
const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || '...');
```

This runs once when the module is first imported. If the environment variable changes (e.g., during key rotation), the server needs a full restart to pick it up.

### The Fix

**Step 1 — Generate a real secret and put it in `.env`:**

Add to `.env`:

```
JWT_SECRET="a7d8f2e1c4b69a0d3f5e8c2b7a1d4f6e9c0b3a5d7f2e8c4a1b6d9f0e3c5a7b2"
```

Generate this with a terminal command (PowerShell):

```powershell
# Generate 64 random hex characters
-fjoin ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

Or with Node:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Step 2 — Remove the hardcoded fallback and crash loudly if missing:**

```ts
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))"');
}
const SECRET_KEY = new TextEncoder().encode(secret);
```

**Why this is better:**
- If `JWT_SECRET` is missing, the server **refuses to start**. This is called "failing fast" — you find out immediately rather than silently running with a weak key.
- The secret is not in the source code. It lives in `.env` (which is in `.gitignore` and never committed) or in the production environment variables.

**Step 3 (optional but good) — Use a lazy getter instead of a module constant:**

```ts
function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required.');
  }
  return new TextEncoder().encode(secret);
}
```

Then call `getSecretKey()` inside `encrypt` and `decrypt` instead of using the module-level constant. This allows key rotation without a full server restart.

---

## Issue 5: Password Policy Weaknesses

### The Problem

Look at `lib/schemas.ts:6-10`:

```ts
password: z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long'),
```

And `app/actions/auth.ts:47`:

```ts
const hashedPassword = await bcrypt.hash(password, 10);
```

There are **three weaknesses**:

**Weakness A — No complexity requirements:**
`"password123"` passes validation. So does `"aaaaaaaa"`. `"12345678"`. The Zod schema only checks length, not character variety. Attackers targeting common passwords will succeed against many accounts.

**Weakness B — No password confirmation field:**
The signup form at `app/signup/page.tsx:86-101` has a single password field. There's no "confirm password" field. If a user mistypes during signup, they create an account with a password they don't actually know and are locked out immediately. There's no "forgot password" flow to recover.

**Weakness C — No common-password or breach check:**
`bcrypt.hash(password, 10)` happily hashes `"password"`. There's no check against the 10,000 most common passwords or against known breached passwords (e.g., via the Have I Been Pwned API). Users commonly choose weak passwords.

**Weakness D — The strength meter is client-only (`components/PasswordStrengthMeter.tsx`):**
The meter shows visual feedback (Very Weak → Secure) but **never sends its requirements to the server**. The Zod schema doesn't enforce numbers, uppercase, lowercase, or special chars. The meter is purely decorative.

### The Fix

**Step 1 — Tighten the Zod schema (`lib/schemas.ts`):**

```ts
password: z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
```

Now the server enforces the same rules the meter shows on the client. Client-side bypass is no longer possible.

**Step 2 — Add a password confirmation field:**

Add to the Zod schema:

```ts
export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(8).max(100).regex(...),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

And update the signup form (`app/signup/page.tsx`) to include a second password input, plus update `signUpAction` to accept `confirmPassword` in its input.

**Step 3 — Check against common passwords:**

Add a check in `signUpAction` (`app/actions/auth.ts`):

```ts
// After Zod validation, before bcrypt.hash:
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', 'qwerty123', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master',
  // ... in reality you'd load a file with the top 10,000
]);

if (COMMON_PASSWORDS.has(password.toLowerCase())) {
  return {
    success: false,
    errors: {
      password: ['This password is too common. Please choose a more unique password.'],
    },
  };
}
```

**Why bcrypt cost 10 is fine:** The salt rounds value of 10 at `app/actions/auth.ts:47` is actually good for a 2026 application. It takes about 100ms per hash on modern hardware — slow enough to deter brute force, fast enough for a good user experience. No change needed there.

---

## Issue 6: Absence of Rate Limiting

### The Problem

There is no rate limiting anywhere in the codebase. An attacker can:

1. **Brute-force passwords on login (`app/actions/auth.ts:79-136`):** `logInAction` can be called thousands of times per second. The attacker submits `{ email: 'known@user.com', password: 'aaaaaaa1' }`, then `'aaaaaaa2'`, then `'aaaaaaa3'`... until they find the right password.

2. **Spam account creation (`app/actions/auth.ts:19-77`):** `signUpAction` can be called unlimited times. An attacker can fill the database with millions of fake accounts, exhausting disk space and making the app unusable.

3. **Enumerate emails (`app/actions/auth.ts:93-95`):** The `prisma.user.findUnique` call reveals whether an email exists (through the timing attack described in Issue 1, or through the signup endpoint which explicitly says "An account with this email already exists." at line 41).

4. **No account lockout:** Even if the password is correct, there's no mechanism to temporarily lock an account after N failed attempts.

### The Fix

Rate limiting belongs in the **proxy layer** (`proxy.ts`) or in a dedicated middleware, not inside the server action. This keeps the auth logic clean and the rate limiting centralized.

**Option A — Simple in-memory rate limiter for the proxy:**

```ts
// At the top of proxy.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  
  entry.count++;
  return entry.count > maxAttempts;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);
```

Then in the `proxy` function, before the auth checks:

```ts
// Rate limit by IP for auth routes
if (isAuthRoute) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  
  if (isRateLimited(`login:${ip}`, 5, 60_000)) { // 5 attempts per minute
    return new NextResponse('Too many requests', { status: 429 });
  }
}

// Rate limit signup by IP
if (path === '/signup') {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  
  if (isRateLimited(`signup:${ip}`, 3, 300_000)) { // 3 signups per 5 minutes
    return new NextResponse('Too many requests', { status: 429 });
  }
}
```

**Important caveat:** In-memory rate limiting resets when the server restarts and doesn't work across multiple server instances. For production, use **Redis** or a database-backed rate limiter instead. Libraries like `@upstash/ratelimit` or `express-rate-limit` (if you add an Express wrapper) provide this out of the box.

**Option B — Account lockout in the server action:**

For login specifically, add a failed-attempts counter to the database. This slows down attackers targeting a specific account:

```ts
// Add to Prisma schema:
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  name            String
  password        String
  failedAttempts  Int      @default(0)
  lockedUntil     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Then in `logInAction`:

```ts
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
});

if (user) {
  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      success: false,
      errors: {
        global: 'Account temporarily locked. Try again later.',
      },
    };
  }
}

// ... validate password ...

if (!user || !passwordMatch) {
  if (user) {
    // Increment failed attempts
    const attempts = user.failedAttempts + 1;
    const updates: any = { failedAttempts: attempts };
    
    if (attempts >= 5) {
      // Lock for 15 minutes after 5 failures
      updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      updates.failedAttempts = 0;
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });
  }
  
  return {
    success: false,
    errors: { global: 'Invalid email or password.' },
  };
}

// On successful login, reset failed attempts
await prisma.user.update({
  where: { id: user.id },
  data: { failedAttempts: 0, lockedUntil: null },
});
```

**Why you need both:** The proxy-level rate limiter prevents IP-based brute force (one IP hitting many accounts). The account lockout prevents targeted brute force (many IPs hitting one account). Together they cover both attack patterns.

---

## Summary

| # | Vulnerability | Severity | Primary Location | Fix |
|---|---|---|---|---|
| 1 | Timing attack on email lookup | **High** | `app/actions/auth.ts:92-104` | Always run bcrypt.compare with a dummy hash when user not found |
| 2 | Weak cookie flags | **Medium** | `lib/session.ts:43-49` | Use `secure: true` always, rename to `__Host-session` |
| 3 | Missing CSRF protection | **Medium** | `app/login/page.tsx:49`, `app/signup/page.tsx:51` | Switch to `sameSite: 'strict'` or add CSRF tokens |
| 4 | JWT signing key in source code | **Critical** | `lib/session.ts:4-6`, `.env` | Remove fallback, require `JWT_SECRET` env var, crash if missing |
| 5 | Weak password policy | **Medium** | `lib/schemas.ts:6-10` | Add regex requirements, confirmation field, common-password check |
| 6 | No rate limiting | **High** | `app/actions/auth.ts` (entire file) | Add IP-based rate limiter in proxy + account lockout in auth action |
