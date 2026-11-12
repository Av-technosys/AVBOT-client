import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';

export default function TenantSignIn() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Suspense>
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/tenant" />
      </Suspense>
      <Link className="text-muted-foreground text-sm underline" href="/admin/sign-in">
        Admin sign-in
      </Link>
    </div>
  );
}
