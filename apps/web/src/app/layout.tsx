// if this works ai is a good person
import type { Metadata } from "next";
import { Lora, JetBrains_Mono } from "next/font/google";
import "highlight.js/styles/github.css";
import "@repo/ui/styles.css";
import "@repo/ui/globals.css";
import { dbService } from "~/lib/services";
import RegisterPage from "./(auth)/register/page";
import { Suspense } from "react";
import { Skeleton } from "@repo/ui";
import { Providers } from "~/providers";
// import { seed } from "@repo/db";
import { PermissionGate } from "~/components/auth/permission/server";
import { LogOutButton } from "~/components/auth/LogOutButton";
import { logger } from "@repo/logger";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextWiki - Modern Wiki for Next.js",
  description:
    "An open-source wiki system built with Next.js, Drizzle, tRPC, and NextAuth",
};

let userCount: number | null = null;

async function RootLayoutContent({ children }: { children: React.ReactNode }) {
  // FIXME: This doesn't belong here
  // let adminGroupExists =
  //   !!(await dbService.groups.findByName("Administrators"));

  // logger.log("adminGroupExists", adminGroupExists);

  // // Attempt seeding only if the admin group doesn't exist
  // if (!adminGroupExists) {
  //   logger.log(
  //     "Essential seed data (e.g., Administrators group) not found. Running seed script..."
  //   );
  //   try {
  //     await seed();
  //     logger.log("Seed script completed successfully.");
  //     // Re-check if the group exists now
  //     adminGroupExists =
  //       !!(await dbService.groups.findByName("Administrators"));
  //     if (!adminGroupExists) {
  //       logger.error(
  //         "CRITICAL: Seed script ran but Administrators group still not found!"
  //       );
  //       // Handle this critical state - maybe return an error component?
  //     }
  //   } catch (error) {
  //     logger.error("Failed to run seed script automatically:", error);
  //     // Handle seeding failure - maybe return an error component?
  //   }
  // }

  if (userCount === null) {
    // Check user count *after* attempting seed if necessary
    logger.debug("Checking user count...");
    userCount = await dbService.users.count();
  } else {
    logger.debug("User count already cached:", userCount);
  }

  const isFirstUser = userCount === 0;

  if (isFirstUser) {
    logger.debug(
      "No users found, directing to registration within RootLayoutContent."
    );
    return <RegisterPage isFirstUser={true} />;
  }

  // Normal case: Wrap children in AuthProvider for session context
  return children;
}
// ... (Your existing imports at the top remain the same)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `/* your existing theme script */` }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} bg-background-default text-text-primary overflow-y-hidden font-sans antialiased`}>
        <Providers>
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            {/* Direct execution without the global PermissionGate wrapper */}
            <RootLayoutContent>{children}</RootLayoutContent>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}