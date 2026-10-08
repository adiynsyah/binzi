// Minimal (auth) layout (card A-13). The full public header/footer is A-14;
// until then the auth shells (src/components/shared/auth/auth-panels.tsx)
// own their entire page surface.
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
