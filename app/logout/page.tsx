'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function LogoutPage() {
  useEffect(() => {
    // Sign out without redirect, then manually navigate using window.location
    signOut({ 
      redirect: false 
    }).then(() => {
      // Use window.location to ensure correct origin (works in both dev and production)
      window.location.href = '/login';
    });
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
        <p className="mt-4 text-[#7895b3]">Logging out...</p>
      </div>
    </div>
  );
}

