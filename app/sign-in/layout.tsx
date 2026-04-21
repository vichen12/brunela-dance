export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`.site-navbar { display: none !important; }`}</style>
      {children}
    </>
  );
}
