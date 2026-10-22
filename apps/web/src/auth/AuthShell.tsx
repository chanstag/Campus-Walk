import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Centered card for the signed-out pages (login, accept invitation). */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <Logo className="size-7" />
          <span className="font-semibold">Campus Walk</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
