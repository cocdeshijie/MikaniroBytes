"use client";

import { Select, SelectOption } from "@/components/ui/Select";

export default function MoveUserSelect({
  currentGroupId,
  groups,
  onSelect,
}: {
  currentGroupId: number;
  groups: { id: number; name: string }[];
  onSelect: (gid: number) => void;
}) {
  const opts: SelectOption[] = groups.map((g) => ({
    value: g.id.toString(),
    label: g.name,
  }));

  return (
    <Select
      value={currentGroupId.toString()}
      onValueChange={(v) => onSelect(+v)}
      options={opts}
    />
  );
}
