import { SignUp } from '@clerk/nextjs';
import { Suspense } from 'react';

export default function TenantSignUp() {
  return (
    <Suspense>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/tenant" />
    </Suspense>
  );
}
