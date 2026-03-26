'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid username or password. Please check your credentials and try again.';
      case 'Configuration':
        return 'Authentication system is not properly configured. Please contact the administrator.';
      case 'AccessDenied':
        return 'Access denied. You do not have permission to access this application.';
      case 'Verification':
        return 'Verification failed. Please try again.';
      case 'Default':
      default:
        return 'An authentication error occurred. Please try signing in again.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Something went wrong during authentication
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Unable to sign in</CardTitle>
            <CardDescription>
              We encountered an error while trying to authenticate you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {getErrorMessage(error)}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Link href="/auth/signin">
                <Button className="w-full">
                  Try again
                </Button>
              </Link>
              
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Return to home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500">
          <p>If this error persists, please check your configuration or contact support.</p>
          {error && (
            <p className="mt-2 font-mono text-xs text-gray-400">Error: {error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
