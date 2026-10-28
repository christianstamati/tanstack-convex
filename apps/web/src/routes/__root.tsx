import type { ConvexQueryClient } from "@convex-dev/react-query";
import {
  SessionProvider,
  SignedIn,
  SignedOut,
  sessionBeforeLoad,
  useSignOutSession,
} from "@samebase/convex-auth-tanstack-start";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Toaster } from "@workspace/ui/components/sonner";
import { ThemeProvider, themeScript } from "@workspace/ui/components/theme-provider";
import { toast } from "sonner";
import { ThemeToggle } from "#/components/theme-toggle";
import { meQuery } from "#/lib/auth";
import { getTheme } from "#/lib/theme";

import appCss from "@workspace/ui/globals.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  // Runs on every navigation, on the server and in the browser. Every route's beforeLoad and
  // loader can then read `context.isAuthenticated`.
  beforeLoad: async (options) => {
    // On the server, gives the session's token to the Convex client, so loaders run as the user.
    const { token } = sessionBeforeLoad(options);
    const { queryClient } = options.context;
    const theme = getTheme();
    if (token === null) {
      // The server found no session: no query needed. The browser gets this answer with the page.
      queryClient.setQueryData(meQuery.queryKey, null);
      return { token, theme, isAuthenticated: false };
    }
    // Usually answered from the cache. It stays live, so a session that ends in another tab
    // shows up on the next navigation.
    const me = await queryClient.query({ ...meQuery, staleTime: "static" });
    return { token, theme, isAuthenticated: me !== null };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "tanstack-convex-starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: Root,
});

function Root() {
  const { convexQueryClient, token, theme } = Route.useRouteContext();
  return (
    <SessionProvider client={convexQueryClient.convexClient} token={token}>
      <ThemeProvider initialTheme={theme}>
        {/* The theme script sets the class and color-scheme before React hydrates. */}
        <html lang="en" suppressHydrationWarning>
          <head>
            <ScriptOnce>{themeScript}</ScriptOnce>
            <HeadContent />
          </head>
          <body>
            <Header />
            <Outlet />
            <Toaster />
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
            <Scripts />
          </body>
        </html>
      </ThemeProvider>
    </SessionProvider>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-4 p-6 pb-0">
      <nav className="flex gap-4 text-sm font-medium">
        <Link to="/">Home</Link>
        <Link to="/notes">Notes</Link>
      </nav>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {/* The server render knows the session from its token, so both agree on the first HTML. */}
        <SignedOut>
          <Link to="/signin" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Sign in
          </Link>
        </SignedOut>
        <SignedIn>
          <Account />
        </SignedIn>
      </div>
    </header>
  );
}

function Account() {
  // In the cache from the root loader when the page was rendered as the user.
  const { data: me } = useQuery(meQuery);
  // A full page load to /, because the page signed out on is usually private.
  const signOut = useSignOutSession("/auth/signout", "/");
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link to="/settings" className="max-w-48 truncate text-muted-foreground hover:underline">
        {me?.name ?? me?.email}
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          if (!(await signOut())) toast.error("Couldn't sign out. Try again.");
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
