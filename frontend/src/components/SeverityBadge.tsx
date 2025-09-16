"use client";

import { Badge } from "@/components/ui/badge";

type Props = { severity: "high" | "medium" | "low" };

export function SeverityBadge({ severity }: Props) {
  if (severity === "high") {
    return (
      <Badge className="bg-red-900 text-red-100 border-red-800 hover:bg-red-800">
        High
      </Badge>
    );
  }
  if (severity === "medium") {
    return (
      <Badge className="bg-yellow-900 text-yellow-100 border-yellow-800 hover:bg-yellow-800">
        Medium
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-900 text-green-100 border-green-800 hover:bg-green-800">
      Low
    </Badge>
  );
}
