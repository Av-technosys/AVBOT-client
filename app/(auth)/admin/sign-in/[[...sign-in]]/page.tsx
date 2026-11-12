import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';

export default function AdminSignIn() {
  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-xl font-semibold">Platform administrator</h1>
      <Suspense>
        <SignIn path="/admin/sign-in" routing="path" withSignUp={false} forceRedirectUrl="/admin" />
      </Suspense>
      <Link className="text-muted-foreground text-sm underline" href="/sign-in">
        Tenant sign-in
      </Link>
    </div>
  );
}
