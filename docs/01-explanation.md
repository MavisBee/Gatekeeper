# The Gatekeeper: Security for 7-Year-Olds (and Grown-ups too!) 🗝️

Welcome to **The Gatekeeper**! We have built a magical digital castle with a very secure front door. Let’s walk through how every part of our castle is built, line by line, so we can understand how we keep bad guys out and keep our friends safe!

---

## 🏛️ The Three Big Secrets of the Castle

We will start with the three super-important security secrets of our castle.

### 1. 🪄 How Passwords Get Hashed and Verified (The Magic Password Mixer)
When you choose a password, you might think we save it in our diary as `MySuperSecret123!`. But if we did that, and someone stole our diary, they would know your password! 

To prevent this, we use a magic spell called **Bcrypt**:
* **Hashing (Mixing):** When you sign up, we take your password and put it inside a magic blender. We spin it around using a secret ingredient called a **Salt** (extra random noise). The blender spits out a completely scrambled mess that looks like this: `$2a$10$X87ad...`. 
* **One-Way Street:** This magic blender only works in *one direction*. You can turn a password into a scrambled mess, but **you can never turn the scrambled mess back into your password**. Even we don't know what your actual password is!
* **Verifying (Matching):** When you try to log in, we don't unscramble the stored hash. Instead, we take the password you just typed, put it in the same magic blender with the same recipe, and see if the new scrambled mess matches the old scrambled mess in our diary. If they match, the door opens!

### 2. 🍪 How the Session Cookie is Created and Read (The Secret Handstamp)
Imagine going to an amusement park. When you buy a ticket, the person at the gate stamps your hand with a special invisible ink that glows under a blue light. Every time you want to ride a roller coaster, you just show your hand. You don't have to buy a new ticket every single time!

In our app, we use a **Session Cookie** as that handstamp:
* **Creation:** When you log in, we create a digital ticket containing your name and user ID. We sign this ticket using a **JWT (JSON Web Token)** signed with a **Secret Recipe Key** that only our server knows.
* **Storing:** We send this ticket back to your browser as an **HTTP-only cookie**. This is a special chest that the browser keeps but *none of your other apps or scripts can touch*. It is locked safe from thieves.
* **Reading on Every Request:** Every time your browser asks the server to show a new page, it automatically sends the cookie along. The server reads the cookie, verifies the secret signature, and knows it’s really you.

### 3. 💂 How the Protected Route Knows You Are Logged In (The Castle Guard)
We have a special room in our castle called the `/dashboard`. Only logged-in people are allowed inside! 

How do we stop people from sneaking in? We place a security guard right at the entrance:
* **The Guard (`proxy.ts`):** Next.js runs a file called `proxy` that intercepts every single page request *before* it gets served. 
* **The Stamped Note Check:** When someone requests `/dashboard`, the guard stops them and asks: *"Can I see your stamped passport?"*
* **The Verdict:**
  * If they have a valid session cookie, the guard smiles and says: *"Come on in, access granted!"*
  * If they don't have it (or if it's fake/expired), the guard sends them straight back to the `/login` page.

---

## 📂 Codebase Walkthrough (Line-by-Line)

Now let's open up all the drawers and inspect our files one by one.

### 1. [prisma/schema.prisma](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/prisma/schema.prisma) — *The Diary Schema*
This file defines the layout of our database diary.

```prisma
// Tells Prisma we want it to build the TypeScript client helper classes
generator client {
  provider = "prisma-client-js"
}

// Tells Prisma we are using a local SQLite database file
datasource db {
  provider = "sqlite"
}

// The blueprint of a User entry in our database
model User {
  id        String   @id @default(uuid()) // A unique ID that looks like 'f47ac10b-58cc...'
  email     String   @unique             // The user's email address (no two can be the same)
  name      String                        // The user's friendly name
  password  String                        // The mixed-up, scrambled password hash
  createdAt DateTime @default(now())     // When they created the account
  updatedAt DateTime @updatedAt          // When their info last changed
}
```

### 2. [lib/db.ts](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/lib/db.ts) — *The Database Connector*
This file sets up a single connection to our SQLite database using Prisma 7's new driver adapter system.

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Prevents creating multiple database connections during development hot-reloads
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

let prisma: PrismaClient;

// Get the database path (defaults to dev.db file)
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

if (process.env.NODE_ENV === 'production') {
  // In production, instantiate the Prisma SQLite driver adapter directly
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  prisma = new PrismaClient({ adapter });
} else {
  // In development, reuse the existing client saved on the global scope if it exists
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
```

### 3. [lib/schemas.ts](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/lib/schemas.ts) — *The Rule Book*
We use **Zod** to write down the strict rules of what names, emails, and passwords must look like.

```typescript
import { z } from 'zod';

// Rules for signing up
export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  // Passwords must be at least 8 characters long to be secure
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
});

// Rules for logging in
export const logInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LogInInput = z.infer<typeof logInSchema>;
```

### 4. [lib/session.ts](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/lib/session.ts) — *The Cookie Factory*
Here is the code that signs tickets (JWT) and locks/unlocks them.

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// The secret key used to seal and verify our cookies (minimum 32 characters)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev_secret_key_must_be_long_and_secure_minimum_32_characters'
);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

// 1. Put user data into the card, stamp it with the secret key, and set expiration to 7 days
export async function encrypt(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

// 2. Read the card, check if the signature matches our secret key, and return the data inside
export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null; // If signature is wrong or cookie was tampered with, return nothing!
  }
}

// Helper: Get user details from the current request cookies
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return await decrypt(token);
}

// Helper: Write the encrypted session into a secure HTTP-Only cookie
export async function setSession(payload: SessionPayload) {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,                         // Crucial: JavaScript cannot read this cookie (prevents XSS theft)
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,               // 7 days
  });
}

// Helper: Remove the cookie when logging out
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
```

### 5. [app/actions/auth.ts](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/actions/auth.ts) — *The Gatekeeper Actions*
These functions run on the server to execute registration, login, and logout.

```typescript
'use server';

import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { signUpSchema, logInSchema, SignUpInput, LogInInput } from '@/lib/schemas';
import { setSession, deleteSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export interface ActionResponse {
  success: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    global?: string;
  };
}

// Action 1: Registration (SignUp)
export async function signUpAction(data: SignUpInput): Promise<ActionResponse> {
  // Always double-check rules on the server (never trust the client alone!)
  const validation = signUpSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: validation.error.flatten().fieldErrors };
  }

  const { name, email, password } = validation.data;

  try {
    // See if someone already has this email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return { success: false, errors: { email: ['An account with this email already exists.'] } };
    }

    // Blend the password (hash it with salt cost factor 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to the database
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    // Stamp a session cookie for them
    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

  } catch (error) {
    return { success: false, errors: { global: 'An unexpected error occurred during signup.' } };
  }

  // Send them to their new dashboard!
  redirect('/dashboard');
}

// Action 2: Authentication (LogIn)
export async function logInAction(data: LogInInput): Promise<ActionResponse> {
  const validation = logInSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, errors: validation.error.flatten().fieldErrors };
  }

  const { email, password } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return { success: false, errors: { global: 'Invalid email or password.' } };
    }

    // Compare input password using the blender matching algorithm
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { success: false, errors: { global: 'Invalid email or password.' } };
    }

    // Credentials are correct! Stamp the session cookie
    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

  } catch (error) {
    return { success: false, errors: { global: 'An unexpected error occurred during login.' } };
  }

  redirect('/dashboard');
}

// Action 3: Dissolve Session (LogOut)
export async function logOutAction() {
  await deleteSession();
  redirect('/');
}
```

### 6. [proxy.ts](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/proxy.ts) — *The Castle Gate Guard*
The Next.js 16 network-boundary proxy checks session cookies before letting users access pages.

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/session';

const protectedRoutes = ['/dashboard'];
const authRoutes = ['/signup', '/login'];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => path.startsWith(route));

  // Extract the session cookie
  const cookie = request.cookies.get('session')?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Rule A: If trying to access /dashboard without a session, send to login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Rule B: If already logged in and trying to go to login/signup, send to dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Tells Next.js to run this proxy on all routes except static assets
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 7. [components/PasswordStrengthMeter.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/components/PasswordStrengthMeter.tsx) — *The Helper Bar*
A client-side interactive widget showing how hard a password is to guess.

```typescript
'use client';

import React from 'react';

interface CriteriaItem {
  label: string;
  met: boolean;
}

interface PasswordStrengthMeterProps {
  password: string;
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  // Test password against five safety checks
  const criteria: CriteriaItem[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number (0-9)', met: /\d/.test(password) },
    { label: 'Contains lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Contains uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Contains special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  // Determine meter color and length based on criteria met count
  const getStrengthLabel = () => {
    if (!password) return { label: 'Empty', colorClass: 'bg-zinc-800 text-zinc-400', progressColor: 'bg-zinc-800', width: 'w-0' };
    if (metCount <= 1) return { label: 'Very Weak', colorClass: 'bg-red-500/20 text-red-400 border border-red-500/30', progressColor: 'bg-red-500', width: 'w-1/5' };
    if (metCount === 2) return { label: 'Weak', colorClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', progressColor: 'bg-orange-500', width: 'w-2/5' };
    if (metCount === 3) return { label: 'Medium', colorClass: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', progressColor: 'bg-yellow-500', width: 'w-3/5' };
    if (metCount === 4) return { label: 'Strong', colorClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', progressColor: 'bg-emerald-500', width: 'w-4/5' };
    return { label: 'Secure', colorClass: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30', progressColor: 'bg-indigo-500', width: 'w-full' };
  };

  const strength = getStrengthLabel();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 font-medium">Password Strength</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${strength.colorClass}`}>
          {strength.label}
        </span>
      </div>

      {/* Progress bar container */}
      <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/30">
        {/* Dynamic bar width and color */}
        <div className={`h-full rounded-full transition-all duration-500 ease-out ${strength.progressColor} ${strength.width}`} />
      </div>

      {/* Checklist items */}
      <ul className="space-y-2 text-xs text-zinc-400">
        {criteria.map((item, idx) => (
          <li key={idx} className="flex items-center space-x-2.5">
            {item.met ? (
              // Green checkmark
              <svg className="w-4 h-4 text-emerald-400 shrink-0 scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              // Grey dot placeholder
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
              </div>
            )}
            <span className={item.met ? 'text-zinc-200' : 'text-zinc-500'}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 🎨 Page Templates (Layout & Look)

### 8. [app/layout.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/layout.tsx) — *The Frame*
The global wrapper that sets the language, enables dark mode by default, and sets the title.

### 9. [app/page.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/page.tsx) — *The Welcome Hall*
A landing page introducing the app with "Sign Up" and "Log In" buttons leading to their forms.

### 10. [app/signup/page.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/signup/page.tsx) — *The Registration Page*
Collects details, feeds the typing password into `PasswordStrengthMeter`, and runs the server registration action with full loading spinners.

### 11. [app/login/page.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/login/page.tsx) — *The Entry Page*
Simple form with email and password inputs, error states, and a submit button invoking the login server action.

### 12. [app/dashboard/page.tsx](file:///c:/Users/User1/Downloads/Task%202%20dev/Gatekeeper/app/dashboard/page.tsx) — *The Protected Vault Room*
Reads user credentials from the cookies on request rendering, displays them, and has a Log Out button executing the logout server action.

---

And that's it! That is how our security door is built, keeping our friends' settings, secrets, and data locked up safe and sound in our digital castle. 🏰🗝️
