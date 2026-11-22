import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGooglePopup(): Promise<{
  idToken: string;
  email: string;
  displayName: string;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return {
    idToken,
    email: result.user.email || '',
    displayName: result.user.displayName || '',
  };
}

export async function signUpWithEmailConfirmation(
  email: string,
  password: string,
  username: string
): Promise<
  | { status: 'NEEDS_CONFIRMATION'; email: string }
  | { status: 'ALREADY_VERIFIED'; idToken: string; email: string; displayName: string }
> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (cleanUsername) {
      await updateProfile(cred.user, { displayName: cleanUsername }).catch(() => {});
    }
    await sendEmailVerification(cred.user);
    return { status: 'NEEDS_CONFIRMATION', email: cred.user.email || cleanEmail };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';

    if (code === 'auth/email-already-in-use') {
      // If the user previously started signup and never confirmed, let them re-send confirmation
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        if (cleanUsername) {
          await updateProfile(cred.user, { displayName: cleanUsername }).catch(() => {});
        }
        await sendEmailVerification(cred.user);
        return { status: 'NEEDS_CONFIRMATION', email: cred.user.email || cleanEmail };
      }
      const idToken = await cred.user.getIdToken(true);
      return {
        status: 'ALREADY_VERIFIED',
        idToken,
        email: cred.user.email || cleanEmail,
        displayName: cred.user.displayName || cleanUsername,
      };
    }

    throw err;
  }
}

export async function resendConfirmationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('No active sign-up session. Please fill out the form again.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadAndCheckEmailConfirmation(): Promise<
  | { verified: false }
  | { verified: true; idToken: string; email: string; displayName: string }
> {
  if (!auth.currentUser) {
    throw new Error('No active sign-up session. Please sign up or log in again.');
  }
  await auth.currentUser.reload();
  if (!auth.currentUser.emailVerified) {
    return { verified: false };
  }
  const idToken = await auth.currentUser.getIdToken(true);
  return {
    verified: true,
    idToken,
    email: auth.currentUser.email || '',
    displayName: auth.currentUser.displayName || '',
  };
}

export async function signInWithEmailAndGetStatus(
  email: string,
  password: string
): Promise<
  | { verified: false; email: string; displayName: string }
  | { verified: true; idToken: string; email: string; displayName: string }
> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  await cred.user.reload();
  if (!cred.user.emailVerified) {
    return {
      verified: false,
      email: cred.user.email || cleanEmail,
      displayName: cred.user.displayName || '',
    };
  }
  const idToken = await cred.user.getIdToken(true);
  return {
    verified: true,
    idToken,
    email: cred.user.email || cleanEmail,
    displayName: cred.user.displayName || '',
  };
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors
  }
}
