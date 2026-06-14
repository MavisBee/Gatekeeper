# Authentication Principles in the Gatekeeper

---

## 1. Never Store Plaintext Passwords

**Plain definition:** Never save the actual password a user types. Instead, scramble it through a one-way mathematical function (hashing) so that even if someone steals the database, they can't recover the original passwords.

| File | Line(s) | What it does |
|---|---|---|
| `app/actions/auth.ts` | 47 | `const hashedPassword = await bcrypt.hash(password, 10)` — the plaintext password is put through bcrypt with a salt cost of 10 before it touches the database |
| `app/actions/auth.ts` | 50-55 | `password: hashedPassword` — only the hash is stored in the `User` record, never the raw string |
| `app/actions/auth.ts` | 107 | `await bcrypt.compare(password, user.password)` — on login, the typed password is re-hashed and compared against the stored hash; the original password is never reconstructed |
| `prisma/schema.prisma` | 12-18 | The `User` model has a `password String` field — the schema does not distinguish plaintext vs hash, but the code guarantees only the hash is ever written there |

**Why it matters:** If the database is leaked, attackers get `$2a$10$...` goop, not `"pancake"`. Bcrypt's slowness makes guessing the original password impractical even with the hash.

---

## 2. Server-Side Validation

**Plain definition:** Never trust what the browser sends. Validate every input on the server, because client-side checks can be bypassed by anyone who knows how to open their browser's developer tools.

| File | Line(s) | What it does |
|---|---|---|
| `lib/schemas.ts` | 3-15 | Zod schemas define the canonical rules: name length 1-100, valid email, password 8-100 chars (signup), non-empty password (login) |
| `app/actions/auth.ts` | 21 | `const validation = signUpSchema.safeParse(data)` — the signup server action re-validates the entire payload server-side before touching the database |
| `app/actions/auth.ts` | 22-26 | `if (!validation.success)` returns field-level errors, rejecting malformed input immediately |
| `app/actions/auth.ts` | 81-86 | Identical server-side re-validation for the login action |

**Why it matters:** The client-side `PasswordStrengthMeter` at `components/PasswordStrengthMeter.tsx` is purely cosmetic. Without server-side validation, someone could send a 1-character password directly to the API. The Zod schemas enforce the real rules on the server where they can't be bypassed.

---

## 3. Defense in Depth

**Plain definition:** Don't rely on a single security layer. Stack multiple independent checks so that if one fails (a bug, a misconfiguration, a bypass), the next one still catches the problem.

| Layer | File | Line(s) | What it does |
|---|---|---|---|
| **Layer 1 — Request bouncer** | `proxy.ts` | 19-21 | Intercepts every HTTP request before it reaches a page; if the path is protected and there's no valid session cookie, the request is redirected to `/login` immediately |
| **Layer 2 — Page-level re-check** | `app/dashboard/page.tsx` | 6 | The dashboard page itself calls `await getSession()` again — even if the proxy had a bug and let someone through, this second read would still fail and the page would render no user data |
| **Layer 3 — Cookie hardening** | `lib/session.ts` | 44-48 | The cookie is locked down with four independent flags: `httpOnly: true` (inaccessible to JavaScript), `secure: true` in production (TLS only), `sameSite: 'lax'` (no cross-site sending), `path: '/'` (scoped to the site) |
| **Layer 4 — JWT integrity** | `lib/session.ts` | 14-19 | The session token is a signed JWT (`HS256`). The server verifies the signature on every read; a tampered cookie is rejected by `jwtVerify` at line 24 |
| **Layer 5 — Expiration** | `lib/session.ts` | 18 | `.setExpirationTime('7d')` — the JWT self-destructs after 7 days, limiting the window of a stolen cookie |
| **Layer 6 — Generic error messages** | `app/actions/auth.ts` | 101, 112 | Both "user not found" and "wrong password" return the identical message `"Invalid email or password."`, preventing attackers from enumerating valid emails |

**Why it matters:** If the proxy config is accidentally removed, the dashboard's own `getSession()` still runs. If the JWT secret leaks, the cookie flags (`httpOnly`, `secure`, `sameSite`) still limit exploitation. Every layer covers the one below it.

---

## 4. Least Privilege

**Plain definition:** Only collect, store, and expose the absolute minimum data needed for the system to function. If a component doesn't need a piece of data, it shouldn't have access to it.

| File | Line(s) | What it does |
|---|---|---|
| `lib/session.ts` | 8-12 | The `SessionPayload` interface contains exactly three fields: `userId`, `email`, `name`. The password hash is **never** included in the session token, even though the server has access to it |
| `app/actions/auth.ts` | 59-63 | The `setSession` call explicitly destructures only `user.id`, `user.email`, `user.name` from the user record — the `password` field is omitted |
| `app/dashboard/page.tsx` | 38-58 | The dashboard renders exactly the three session fields (name, email, userId). It never fetches or displays the password hash, creation date, or any other database columns |
| `proxy.ts` | 6-7 | The proxy only knows about two route lists (`protectedRoutes`, `authRoutes`). It doesn't have access to the database, user records, or any credentials — it only reads the cookie |
| `lib/session.ts` | 33-38 | `getSession` only returns the decrypted payload; it never fetches the full user row from the database |

**Why it matters:** If the session cookie is stolen, the attacker gets a name, email, and ID — not the password hash. If the proxy is compromised, it can't query user records. Each component sees only what it absolutely needs.

---

## 5. Secure Defaults

**Plain definition:** The system should be safe by default without requiring the developer to remember to turn security on. If a setting is omitted, it should default to the more secure option.

| File | Line(s) | What it does |
|---|---|---|
| `lib/session.ts` | 44 | `httpOnly: true` — always on, never configurable. Cookies are inaccessible to JavaScript by default |
| `lib/session.ts` | 45 | `secure: process.env.NODE_ENV === 'production'` — cookies are only sent over HTTPS in production. In development (localhost), HTTP is allowed (since localhost doesn't have a TLS cert), but the default for production is secure |
| `lib/session.ts` | 46 | `sameSite: 'lax'` — always on, never configurable. The cookie won't be sent on cross-site requests by default |
| `lib/session.ts` | 48 | `maxAge: 604800` — sessions automatically expire after 7 days. There is no "remember forever" option |
| `lib/session.ts` | 17-18 | `.setIssuedAt().setExpirationTime('7d')` — every JWT has a birth date and an expiration date by default. Untimed tokens are never created |
| `lib/session.ts` | 24-25 | `jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] })` — the algorithm is explicitly pinned to `HS256`. Algorithm confusion attacks (where an attacker swaps the alg to `none`) are blocked |
| `app/actions/auth.ts` | 101, 112 | `"Invalid email or password."` — the default error message is deliberately vague. It does **not** say "email not found" or "wrong password" |
| `proxy.ts` | 19-21 | If a route is protected and there's no session, the default behavior is **rejection** (redirect to login). There is no configuration that would let unauthenticated users through to the dashboard by accident |

**Why it matters:** A developer doesn't need to remember to add `httpOnly`, `sameSite`, or an expiration — they're baked in. The secure path is the default path, and weakening security requires an intentional change.
