"use client";

import { BiMoon, BiSun } from "react-icons/bi";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    // If you'd like to also call your backend /auth/logout, do so here:
    await fetch("http://localhost:8000/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: session?.accessToken }),
    });
    // Then sign out from NextAuth:
    await signOut();
  };

  return (
    <div className="fixed top-3 right-3 flex items-center gap-3 z-50">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-full bg-white/70 dark:bg-black/30
                  ring-1 ring-black/10 dark:ring-white/20
                  backdrop-blur hover:bg-white/90 dark:hover:bg-black/60
                  transition-colors text-gray-800 dark:text-gray-200"
      >
        {theme === "dark" ? <BiSun size={20} /> : <BiMoon size={20} />}
      </button>

      {session?.accessToken && (
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-full
                     hover:bg-red-700 transition-colors shadow-md"
        >
          Logout
        </button>
      )}
    </div>
  );
}
