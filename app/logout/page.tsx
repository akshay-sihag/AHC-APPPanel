'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Sign out without redirect, then manually navigate
    signOut({ 
      redirect: false 
    }).then(() => {
      // Manually redirect to login page
      router.push('/login');
      router.refresh();
    });
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
        <p className="mt-4 text-[#7895b3]">Logging out...</p>
      </div>
    </div>
  );
}

