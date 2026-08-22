import { ResourceCard } from "./ResourceCard";
import {
  columnOneResources,
  columnTwoResources,
} from "../data/resourcesData";

export function ResourcesGrid() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-bold text-foreground">Useful resources:</p>
      <div className="flex gap-3">
        <div className="flex flex-col gap-3 w-1/2">
          {columnOneResources.map((res) => (
            <ResourceCard
              key={res.title}
              title={res.title}
              description={res.description}
              href={res.href}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3 w-1/2">
          {columnTwoResources.map((res) => (
            <ResourceCard
              key={res.title}
              title={res.title}
              description={res.description}
              href={res.href}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
