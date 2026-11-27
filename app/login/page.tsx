import { getCurrentOrg } from "@/lib/org";
import LoginClient from "./login-client";

// Server wrapper: resolves the tenant brand from the request hostname
// and hands it to the client-side login form. Studio 360 visitors see
// their wordmark + "Powered by CIRIS" footer; chapter103 keeps the
// original CIRIS panel.
export default async function LoginPage() {
  const org = await getCurrentOrg();
  return (
    <LoginClient
      brand={{
        displayName: org?.displayName ?? null,
        logoUrl: org?.logoUrl ?? null,
        poweredByCiris: org?.poweredByCiris ?? false,
      }}
    />
  );
}
