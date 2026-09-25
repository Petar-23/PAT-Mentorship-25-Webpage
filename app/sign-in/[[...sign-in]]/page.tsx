import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      {/*
        Fallback, wenn kein ?redirect_url=… mitkommt (z. B. direkter Link auf /sign-in):
        ins Dashboard statt auf die Startseite (after_sign_in_url/after_sign_up_url im Clerk-Dashboard).
        Ein mitgegebenes redirect_url (Middleware-Deep-Links, Raid Map) hat bei Clerk Vorrang.
      */}
      <SignIn fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />
    </div>
  )
}
