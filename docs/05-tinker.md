# Tinker: Removing bcrypt Password Verification

## Target

The password verification function in `app/actions/auth.ts:107`:

```typescript
const passwordMatch = await bcrypt.compare(password, user.password);
```

## Prediction

If I replace `bcrypt.compare(password, user.password)` with a plain string equality check `password === user.password`, the following will happen:

### Runtime behavior

`user.password` is a bcrypt hash string (e.g. `$2b$10$oe4Pc44ilKjJ1DxqIz...`), not the plaintext password. The plain `===` comparison will compare the user's raw input (e.g. `"MyP@ssw0rd!"`) against this hash string. Since a bcrypt hash and a plaintext password are structurally completely different, the comparison **always returns `false`** — for both correct and incorrect passwords.

### Security consequences

| Consequence | Severity | Explanation |

| Complete authentication lockout | **Critical** | Every login attempt fails, including legitimate users. The app becomes unusable. |
| Timing side-channel | Low | JavaScript `===` is not constant-time, unlike `bcrypt.compare`. However, since both branches always return `false`, the timing difference is irrelevant. |
| Plaintext exposure (if signup also changed) | **Critical** | If hashing during signup were also removed and passwords stored as plaintext, then `===` would let anyone who breaches the database directly read every user's password. |

**Bottom line:** the change breaks authentication entirely. No user can log in, regardless of whether they provide the correct password.

## The Change

Edited `app/actions/auth.ts` — replaced:

```typescript
const passwordMatch = await bcrypt.compare(password, user.password);
```

with:

```typescript
const passwordMatch = password === user.password;
```

## Test

### Setup

1. A test user was created in the database with `bcrypt.hash(correctPassword, 10)` (simulating normal signup).
2. The dev server was started on `http://localhost:3000`.
3. Attempted to log in with an **incorrect** password via the login form.

### Observation

**Every login attempt returned "Invalid email or password."** — even with the correct password. The reason: the stored bcrypt hash `$2b$10$aNWjkEDr...` never equals the raw input string `"CorrectP@ss1"`.

### Proof

From the integration test:

```
=== TESTING WITH BROKEN CODE (plain ===) ===
Correct password via plain ===: false
Wrong password via plain ===: false

=== TESTING WITH ORIGINAL CODE (bcrypt.compare) ===
Correct password via bcrypt.compare: true
Wrong password via bcrypt.compare: false
```

### Screenshot

Submitting the login form with any password (correct or incorrect) resulted in the error message **"Invalid email or password."** being displayed on the page.

## Lessons

- `bcrypt.compare` exists specifically because the stored hash is intentionally different from the raw password. A plain `===` comparison against a hash will **always** reject every login.
- BCrypt's strength is not just the comparison algorithm but the **one-way hashing** scheme. Even if you changed both signup and login to use plaintext + `===`, you would lose all protection against credential theft via database breach.
- Always use a dedicated password comparison function (bcrypt.compare, argon2.verify, etc.) — never compare hash strings with `===`.
