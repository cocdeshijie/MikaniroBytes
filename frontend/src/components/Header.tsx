"use client";

import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { tokenAtom } from "@/atoms/auth";
import { BiMoon, BiSun } from "react-icons/bi";
import { useTheme } from "next-themes";

export default function Header() {
  const router = useRouter();
  const [token, setToken] = useAtom(tokenAtom);
  const { theme, setTheme } = useTheme();

  // Logout function clears token and localStorage, then redirects to homepage
  const handleLogout = async () => {
    // If you have a real logout endpoint:
    // await fetch("http://localhost:8000/auth/logout", { ... });
    setToken(null);
    localStorage.removeItem("token");
    router.push("/");
  };

  // Toggle between light and dark modes (just an example)
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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

      {token && (
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
