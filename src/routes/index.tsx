import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">PORTALONE</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Scaffold online</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mission control is being rebuilt, one commit at a time.
        </p>
      </div>
    </main>
  );
}
