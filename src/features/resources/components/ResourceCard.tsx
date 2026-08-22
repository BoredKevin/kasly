import { Card, CardContent } from "@boredkevin/ui";

interface ResourceCardProps {
  title: string;
  description: string;
  href: string;
}

export function ResourceCard({ title, description, href }: ResourceCardProps) {
  return (
    <Card
      cornerLines={true}
      className="p-4 h-28 overflow-auto border border-border/80 bg-card/70 hover:bg-card/90 transition-colors"
    >
      <CardContent className="p-0 flex flex-col gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-foreground underline hover:no-underline"
        >
          {title}
        </a>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
