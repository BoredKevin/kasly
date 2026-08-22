export interface ResourceItem {
  title: string;
  description: string;
  href: string;
}

export const columnOneResources: ResourceItem[] = [
  {
    title: "Convex docs",
    description: "Read comprehensive documentation for all Convex features.",
    href: "https://docs.convex.dev/home",
  },
  {
    title: "Stack articles",
    description:
      "Learn about best practices, use cases, and more from a growing\n            collection of articles, videos, and walkthroughs.",
    href: "https://www.typescriptlang.org/docs/handbook/2/basic-types.html",
  },
];

export const columnTwoResources: ResourceItem[] = [
  {
    title: "Templates",
    description: "Browse our collection of templates to get started quickly.",
    href: "https://www.convex.dev/templates",
  },
  {
    title: "Discord",
    description:
      "Join our developer community to ask questions, trade tips & tricks,\n            and show off your projects.",
    href: "https://www.convex.dev/community",
  },
];
