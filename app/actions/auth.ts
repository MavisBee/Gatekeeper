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

export async function signUpAction(data: SignUpInput): Promise<ActionResponse> {
  // Validate fields server-side
  const validation = signUpSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = validation.data;

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return {
        success: false,
        errors: {
          email: ['An account with this email already exists.'],
        },
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    // Set user session cookie
    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

  } catch (error) {
    console.error('Sign up error:', error);
    return {
      success: false,
      errors: {
        global: 'An unexpected error occurred during signup.',
      },
    };
  }

  // Redirect to dashboard
  redirect('/dashboard');
}

export async function logInAction(data: LogInInput): Promise<ActionResponse> {
  // Validate fields server-side
  const validation = logInSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validation.data;

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return {
        success: false,
        errors: {
          global: 'Invalid email or password.',
        },
      };
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return {
        success: false,
        errors: {
          global: 'Invalid email or password.',
        },
      };
    }

    // Set user session cookie
    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

  } catch (error) {
    console.error('Log in error:', error);
    return {
      success: false,
      errors: {
        global: 'An unexpected error occurred during login.',
      },
    };
  }

  // Redirect to dashboard
  redirect('/dashboard');
}

export async function logOutAction() {
  await deleteSession();
  redirect('/');
}
