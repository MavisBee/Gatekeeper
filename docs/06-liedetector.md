# Lie Detector: Auth Flow Statements

Five statements about the Gatekeeper authentication flow. Four are true, one is false. Can you spot the lie?

## The Statements

1. **Statement 1** — The signup form requires the password to be at least 8 characters.
2. **Statement 2** — The login form requires the password to be at least 8 characters.
3. **Statement 3** — The session JWT is signed using the HS256 algorithm.
4. **Statement 4** — The middleware protects `/dashboard` and also redirects authenticated users away from `/login` and `/signup`.
5. **Statement 5** — When a user signs up, their password is hashed with bcrypt using 10 salt rounds before being stored.

---

## Investigation

### Statement 1 — TRUE

`lib/schemas.ts:8` — the `signUpSchema` Zod object validates:

```typescript
password: z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long'),
```

A minimum length of 8 characters is enforced server-side.

### Statement 2 — FALSE (the lie)

`lib/schemas.ts:12-15` — the `logInSchema` Zod object validates:

```typescript
export const logInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
```

The password field only requires `min(1)` — i.e., it must not be empty. There is **no minimum length of 8** on the login side. A 3-character password would be accepted by the schema (though it would still fail bcrypt comparison against the stored hash of the real 8+ character password).

This is a plausible trap: since the signup form enforces length, a reader might assume the login form does too, but it doesn't — the validation is intentionally relaxed because the bcrypt comparison will reject wrong passwords regardless.

### Statement 3 — TRUE

`lib/session.ts:16` — the JWT is created with:

```typescript
.setProtectedHeader({ alg: 'HS256' })
```

HS256 (HMAC with SHA-256) is confirmed.

### Statement 4 — TRUE

`proxy.ts:6-7, 18-26` — the middleware defines:

```typescript
const protectedRoutes = ['/dashboard'];
const authRoutes = ['/signup', '/login'];
```

It redirects unauthenticated users from `/dashboard` to `/login` (line 20), and authenticated users from `/login` or `/signup` to `/dashboard` (line 25).

### Statement 5 — TRUE

`app/actions/auth.ts:47` — during signup:

```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

The second argument `10` is the salt round factor.

---

## Answer

**Statement 2 is the lie.** The login schema does not enforce a minimum password length of 8 characters — it only requires the field to be non-empty (`min(1)`). The 8-character minimum exists only in the signup schema.
