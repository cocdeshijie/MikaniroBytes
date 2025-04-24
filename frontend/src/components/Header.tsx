"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { BiMoon, BiSun, BiMenu, BiChevronDown } from "react-icons/bi";
import * as Dialog from "@radix-ui/react-dialog";
import { atom, useAtom } from "jotai";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { api } from "@/lib/api";

/* ────────────────────────────────────────────────────────────────── */
/*  Atoms                                                             */
/* ────────────────────────────────────────────────────────────────── */
const logoHoverAtom  = atom(false);
const scrollAtom     = atom(false);
const dialogOpenAtom = atom(false);
const regEnabledAtom = atom<null | boolean>(null); // ← null = loading

/* ------------------------------------------------------------------ */
/*  helper – decide if a link is active                               */
/* ------------------------------------------------------------------ */
const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/* ────────────────────────────────────────────────────────────────── */
/*  Logo Component                                                    */
/* ────────────────────────────────────────────────────────────────── */
const Logo = () => {
  const [isHovered, setIsHovered] = useAtom(logoHoverAtom);

  return (
    <Link href="/">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative z-10 flex justify-center w-full"
      >
        <div className="flex flex-col items-center font-medium">
          <div className="flex items-end space-x-1.5 md:text-xl">
            <div
              className={cn(
                "pt-3 pb-0.5 px-2 rounded-xl items-center",
                "bg-theme-100/25 dark:bg-theme-900/50",
                isHovered
                  ? "bg-theme-500 text-white dark:text-white"
                  : "text-theme-500 dark:text-theme-300"
              )}
            >
              File
            </div>
            <div
              className={cn(
                "pb-0.5 text-theme-500 dark:text-white",
                isHovered && "animate-spin"
              )}
            >
              🔄
            </div>
            <div className="pb-0.5 text-theme-500 dark:text-white">Bed</div>
          </div>
          {isHovered && (
            <div
              className={cn(
                "absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 duration-500 transition-opacity",
                "text-[10px] font-normal text-theme-500 dark:text-white whitespace-nowrap"
              )}
            >
              Securely store and share your files
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Mobile Navigation Dialog                                          */
/* ────────────────────────────────────────────────────────────────── */
const MobileNavDialog = () => {
  const [isOpen, setIsOpen] = useAtom(dialogOpenAtom);
  const { data: session }   = useSession();
  const pathname            = usePathname();
  const [regEnabled]        = useAtom(regEnabledAtom);

  const handleLogout = async () => {
    if (session?.accessToken) {
      /* uses api() – adds Authorization header for us */
      try {
        await api("/auth/logout", {
          method: "POST",
          token : session.accessToken,
        });
      } catch {
        /* ignore – sign-out proceeds anyway */
      }
    }
    await signOut();
  };

  /* show common routes */
  const navItems = [{ title: "Home", href: "/" }];

  /* auth-only routes */
  if (session?.accessToken) {
    navItems.push({ title: "Dashboard", href: "/dashboard" });
    navItems.push({ title: "Profile",   href: "/profile"   });
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger className="md:hidden">
        <BiMenu size={24} className="text-theme-700 dark:text-theme-300" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-theme-950/25 dark:bg-theme-50/25 z-50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 rounded-t-xl p-4 h-5/6 z-50",
            "bg-theme-100/75 dark:bg-theme-900/75 backdrop-blur-xl"
          )}
        >
          <BiChevronDown
            onClick={() => setIsOpen(false)}
            className="w-12 h-12 cursor-pointer mx-auto text-theme-500 dark:text-theme-300"
          />
          <div className="flex flex-col space-y-3 mt-4">
            {navItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex justify-between items-center w-full p-3 rounded-lg",
                  "text-theme-900 dark:text-theme-100",
                  isActive(pathname, item.href)
                    ? "bg-theme-200 dark:bg-theme-700"
                    : "hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                )}
              >
                {item.title}
              </Link>
            ))}

            {/* logout button (mobile) */}
            {session?.accessToken && (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex justify-between items-center w-full p-3 rounded-lg",
                  "text-red-600 dark:text-red-500",
                  "hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                )}
              >
                Logout
              </button>
            )}

            {/* login / register for guests (mobile) */}
            {!session?.accessToken && (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex justify-between items-center w-full p-3 rounded-lg",
                    "text-theme-900 dark:text-theme-100",
                    "hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                  )}
                >
                  Login
                </Link>
                {regEnabled && (
                  <Link
                    href="/auth/register"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex justify-between items-center w-full p-3 rounded-lg",
                      "text-theme-900 dark:text-theme-100",
                      "hover:bg-theme-200/50 dark:hover:bg-theme-800/50"
                    )}
                  >
                    Register
                  </Link>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Main Header Component                                             */
/* ────────────────────────────────────────────────────────────────── */
const Header = () => {
  const [isScrolled, setIsScrolled] = useAtom(scrollAtom);
  const [regEnabled, setRegEnabled] = useAtom(regEnabledAtom);
  const { data: session }           = useSession();
  const { theme, setTheme }         = useTheme();
  const pathname                    = usePathname();

  /* track scroll shadow */
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setIsScrolled]);

  /* fetch public-registration switch once – via api() */
  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ enabled: boolean }>("/auth/registration-enabled");
        setRegEnabled(Boolean(data.enabled));
      } catch {
        setRegEnabled(true); // network failure → assume enabled
      }
    })();
  }, [setRegEnabled]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    if (session?.accessToken) {
      try {
        await api("/auth/logout", {
          method: "POST",
          token : session.accessToken,
        });
      } catch {/* ignore */}
    }
    await signOut();
  };

  /* desktop centre nav */
  const navItems = [{ title: "Home", href: "/" }];
  if (session?.accessToken) {
    navItems.push({ title: "Dashboard", href: "/dashboard" });
    navItems.push({ title: "Profile",   href: "/profile" });
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 p-5 md:py-3 md:px-8 md:top-4 md:left-16 md:right-16 z-50",
        "bg-theme-100/80 dark:bg-theme-800/80 backdrop-blur-lg",
        "rounded-none md:rounded-xl shadow-md flex justify-between items-center"
      )}
    >
      {/* Mobile hamburger */}
      <div className="md:hidden">
        <MobileNavDialog />
      </div>

      {/* Logo */}
      <div className="md:flex items-center">
        <Logo />
      </div>

      {/* Centre nav (desktop) */}
      <div className="hidden md:flex items-center justify-center flex-1">
        <nav className="relative">
          <ul className="flex justify-center items-center space-x-2">
            {navItems.map((item) => (
              <li key={item.title} className="relative">
                <Link
                  href={item.href}
                  className={cn(
                    "block px-6 py-2 rounded-lg font-medium transition-colors",
                    isActive(pathname, item.href)
                      ? "bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-white"
                      : "text-theme-600 dark:text-theme-300 hover:bg-theme-200/70 dark:hover:bg-theme-800/70"
                  )}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Right-hand buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-white/70 dark:bg-black/30
                     ring-1 ring-black/10 dark:ring-white/20
                     backdrop-blur hover:bg-white/90 dark:hover:bg-black/60
                     transition-colors text-gray-800 dark:text-gray-200"
        >
          {theme === "dark" ? <BiSun size={20} /> : <BiMoon size={20} />}
        </button>

        {session?.accessToken ? (
          /* logged-in desktop buttons */
          <div className="hidden md:block">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-full
                         hover:bg-red-700 transition-colors shadow-md"
            >
              Logout
            </button>
          </div>
        ) : (
          /* guest desktop buttons */
          <div className="hidden md:block">
            <div className="flex gap-2">
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-theme-500 text-white rounded-full
                           hover:bg-theme-600 transition-colors shadow-md"
              >
                Login
              </Link>
              {regEnabled && (
                <Link
                  href="/auth/register"
                  className="px-4 py-2 bg-gray-600 text-white rounded-full
                             hover:bg-gray-700 transition-colors shadow-md"
                >
                  Register
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
