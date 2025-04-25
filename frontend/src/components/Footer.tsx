export default function Footer() {
  return (
    <footer
      className="text-center py-8 bg-theme-50 dark:bg-theme-950
                 text-theme-600 dark:text-theme-400
                 border-t border-theme-200 dark:border-theme-800"
    >
      <p>
        &copy; {new Date().getFullYear()} <a href={"https://qwq.xyz"}>cocdeshijie</a>
      </p>
    </footer>
  );
}
