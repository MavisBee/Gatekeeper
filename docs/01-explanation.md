# How The Gatekeeper Works

Welcome, young coder! Imagine the Gatekeeper is a **secret clubhouse** for grown-ups on the internet. You need a key (a password) to get in, and once you're inside, the clubhouse remembers you with a special stamp on your hand (a cookie).

Let's walk through the whole thing, line by line, like we're reading a storybook.

---

## 🏠 What's in the clubhouse?

The code lives in a folder called `Gatekeeper`. Here are the important pieces:

| File | What it does |
|---|---|
| `proxy.ts` | The **bouncer** at the front door — checks everyone who walks in |
| `lib/session.ts` | The **hand-stamp maker** — creates and reads the special stamp |
| `lib/schemas.ts` | The **rule book** — says what a password and email must look like |
| `lib/db.ts` | The **filing cabinet** — stores all the member names and secret keys |
| `app/actions/auth.ts` | The **secretary** — does the signing up, logging in, and logging out |
| `app/signup/page.tsx` | The **new-member form** — where you sign up |
| `app/login/page.tsx` | The **returning-member form** — where you log in |
| `app/dashboard/page.tsx` | The **clubhouse room** — only members can see it |
| `prisma/schema.prisma` | The **blueprint** for the filing cabinet |

Now let's dig into the three most important things.

---

## 🔐 Part 1: How passwords get hashed and verified

### Signing up (making your secret key)

When a new person comes to the sign-up page (`app/signup/page.tsx`) and types their name, email, and password, the page calls the secretary:

```
app/signup/page.tsx:20 →
app/actions/auth.ts:19  (signUpAction)
```

The secretary first checks the rule book (`lib/schemas.ts`) to make sure the password is at least 8 letters long and the email looks like a real email.

Then, at **line 47** of `app/actions/auth.ts`, the most important thing happens:

```ts
const hashedPassword = await bcrypt.hash(password, 10);
```

**What is hashing?** Imagine you have a secret word like "pancake". Hashing is like putting it through a **magic blender**. The blender turns "pancake" into a giant messy goop of letters and numbers like `$2a$10$7Q...`. You can NEVER turn the goop back into "pancake" — it's a one-way street! That's what makes it safe.

The `10` is the salt factor — it tells the blender to be extra slow and chunky, so bad guys can't guess passwords quickly.

The messy goop is saved into the filing cabinet (the database) at **line 50-56**:

```
prisma/schema.prisma:16 — the User model has a "password" field
The database stores: { name: "Alex", email: "alex@email.com", password: "$2a$10$..." }
```

The real password "pancake" is **never** saved. Only the goop is saved.

### Logging in (showing your secret key)

When you come back and type your password again (`app/login/page.tsx:18`), the secretary does this at **line 107** of `app/actions/auth.ts`:

```ts
const passwordMatch = await bcrypt.compare(password, user.password);
```

`user.password` is the goop from the filing cabinet. The secretary takes your typed-in password ("pancake"), puts it through the same magic blender, and checks if the goop matches the goop that's stored.

- If the goops match → ✅ **You're in!**
- If they don't match → ❌ "Invalid email or password." (line 108-114)

It says the **same message** whether the email is wrong or the password is wrong, so bad guys can't tell which one they guessed correctly.

### The rule book (Zod schemas)

At `lib/schemas.ts:3-10`:
- Name must be at least 1 letter and not too long
- Email must look like `something@something.com`
- Password must be at least 8 characters, at most 100

There's also a **Password Strength Meter** at `components/PasswordStrengthMeter.tsx` that lives on the sign-up page. It checks if your password has numbers, capital letters, etc. — but it's just a helper on the screen. The real rules are enforced by the secretary server-side.

---

## 🍪 Part 2: How the session cookie is created and read on every request

### The hand stamp (session cookie)

After you sign up or log in successfully, the secretary gives you a **hand stamp** — a little token that proves you're a club member. This lives at `lib/session.ts`.

### Making the stamp (`setSession` — line 40-50)

At **line 40-50** of `lib/session.ts`:

```ts
const token = await encrypt(payload);
cookieStore.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
```

The `encrypt` function (line 14-19) wraps your **userId**, **email**, and **name** into a special JWT package:

```ts
await new SignJWT({ userId, email, name })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(SECRET_KEY);
```

Think of a JWT like a **magic envelope** that:
1. Has your name on it (userId, email, name)
2. Is sealed with a super-secret wax stamp (the `SECRET_KEY` at line 4-6)
3. Has an expiry date of 7 days (after a week, the stamp magically disappears)

The `SECRET_KEY` is a long password that only the clubhouse knows. It's stored in the environment (`.env`) or uses a fallback for development.

The cookie properties mean:
- `httpOnly: true` — a sneaky script on the page can't steal the cookie
- `secure: true` in production — the cookie only travels over the secure HTTPS tunnel
- `sameSite: 'lax'` — the cookie won't go to other websites
- `maxAge: 604800` — the stamp lasts 7 days, then fades away

The cookie is **set** in `app/actions/auth.ts` at lines 59-63 (after signup) and lines 117-122 (after login):

```ts
await setSession({ userId: user.id, email: user.email, name: user.name });
```

### Reading the stamp (`getSession` — line 33-38)

On every protected request, the clubhouse asks "Do you have a hand stamp?" at **line 33-38**:

```ts
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return await decrypt(token);
}
```

It looks at the cookie jar on your browser, finds the one named "session", and opens the magic envelope with the `decrypt` function (line 22-31).

The `decrypt` function uses the same SECRET_KEY to check:
1. Was this envelope really sealed by the clubhouse? (valid signature)
2. Is the envelope still fresh? (not expired)
3. Has anyone tried to open and re-glue it? (tamper check)

If anything is wrong, it returns `null` — **no stamp, no entry**.

### Removing the stamp (`deleteSession` — line 52-54)

When you log out (`app/actions/auth.ts:138-140`):

```ts
export async function logOutAction() {
  await deleteSession();
  redirect('/');
}
```

`deleteSession` (line 52-54) simply throws away the cookie. The stamp is gone.

---

## 🚧 Part 3: How the protected route knows you are logged in

### The bouncer (proxy.ts)

Before anyone can even reach a page, the **bouncer** at `proxy.ts` checks them. This file runs on **every single request** to the website.

At **line 1-3**, it imports the tools it needs:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/session';
```

At **lines 6-7**, it knows which pages are which:

```ts
const protectedRoutes = ['/dashboard'];   // only members allowed
const authRoutes = ['/signup', '/login']; // only NON-members allowed
```

At **lines 9-29**, the bouncer's logic runs on every request:

```ts
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;          // What page are they asking for?
  const isProtectedRoute = protectedRoutes.some(...); // Is it a members-only room?
  const isAuthRoute = authRoutes.some(...);           // Is it a sign-up/login page?

  const cookie = request.cookies.get('session')?.value;  // Show me your hand stamp
  const session = cookie ? await decrypt(cookie) : null; // Is it real?

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url)); // 🚫 No stamp? Go to login!
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url)); // 🔁 Already a member? Go to dashboard!
  }

  return NextResponse.next(); // ✅ Everything's fine, come on in
}
```

It's like a flowchart:

```
                   ┌─────────────────────────┐
                   │  Someone knocks on the   │
                   │     clubhouse door        │
                   └──────────┬──────────────┘
                              │
                   ┌──────────▼──────────────┐
                   │  Where do they want      │
                   │  to go?                  │
                   └──────────┬──────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
   ┌────────▼────────┐ ┌─────▼──────┐ ┌───────▼────────┐
   │  /dashboard     │ │ /login or  │ │  anywhere else │
   │  (members only) │ │ /signup    │ │  (home page)   │
   └────────┬────────┘ └─────┬──────┘ └───────┬────────┘
            │                │                │
      Do they have      Do they have       Let them
      a hand stamp?     a hand stamp?      through ✅
            │                │
       ┌────┴────┐      ┌───┴───┐
       │YES │ NO │      │YES│ NO│
       │    │    │      │   │   │
       │ ✅ │ 🚫 │      │ 🔁│ ✅│
       │    │ Go │      │Go  │   │
       │    │ to │      │to  │   │
       │    │login│     │das │   │
       │    │    │      │hbd │   │
       └────┴────┘      └───┴───┘
```

### The matcher (lines 31-33)

At **line 31-33**:

```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

This is like a sign on the bouncer's booth that says "Check EVERYONE except:
- API routes (internal stuff)
- Static files (pictures, styles)
- The little icon in the browser tab"

Everything else goes through the bouncer.

### The dashboard double-checks

Even though the bouncer already checked, the dashboard page at `app/dashboard/page.tsx:6` checks again:

```ts
const session = await getSession();
```

This calls the same `getSession()` from `lib/session.ts:33-38` to read the cookie and decrypt it. Then it uses `session?.name`, `session?.email`, and `session?.userId` to show who you are on the page (lines 38, 49, 53, 57).

This is like the clubhouse manager asking to see your stamp AGAIN before letting you grab a snack — double safety!

---

## 🗺️ Putting it all together — the full journey

### New member (sign up)

1. You fill out the form on `/signup`
2. The form calls `signUpAction` (a server action)
3. The secretary checks the rules (Zod), checks if your email is already used
4. Your password goes through the **magic blender** → becomes goop (`bcrypt.hash`)
5. Your name, email, and the goop are saved in the database
6. A **hand stamp** (JWT cookie) is created with your userId, email, name
7. You're sent to the dashboard 🎉

### Returning member (log in)

1. You type your email and password on `/login`
2. The form calls `logInAction`
3. The secretary finds your email in the database
4. Your password goes through the blender again — does the goop match? (`bcrypt.compare`)
5. ✅ If yes → new hand stamp → redirect to dashboard
6. ❌ If no → "Invalid email or password."

### Coming back later (the cookie)

1. You type `gatekeeper.com/dashboard` in your browser
2. The **bouncer** (`proxy.ts`) intercepts the request
3. It looks for the "session" cookie in your browser
4. It opens the magic envelope with the SECRET_KEY
5. If it's a real, un-tampered, not-expired envelope → **welcome to the dashboard**
6. If there's no envelope or it's fake → **redirect to /login**

### Leaving (log out)

1. You click "Log Out" on the dashboard
2. `logOutAction` is called
3. The hand stamp is thrown away (`deleteSession`)
4. You go back to the home page

---

## 🧠 Summary

| Concept | What it is | Where |
|---|---|---|
| **Hashing** | Turning "pancake" into goop so the real password is never stored | `app/actions/auth.ts:47` (hash), `:107` (compare) |
| **Session cookie** | A hand stamp that says "I'm Alex, ID 123" | `lib/session.ts` |
| **JWT** | A magic envelope sealed with a secret wax stamp | `lib/session.ts:14-19` (encrypt), `:22-31` (decrypt) |
| **Bouncer** | Checks every visitor before they reach a page | `proxy.ts` |
| **Protected route** | The dashboard — only people with a hand stamp can see it | `proxy.ts:19-21` + `app/dashboard/page.tsx` |

And that's how the Gatekeeper clubhouse works! When you sign up, the password is hashed so nobody can steal it. When you log in, you get a cookie that is automatically checked on every request. And the bouncer at the front door makes sure only club members get into the secret rooms. 🔐✨
