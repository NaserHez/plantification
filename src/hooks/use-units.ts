import { useEffect, useState } from "react";
import { getUnitSystem, onUnitSystemChange, type UnitSystem } from "@/lib/units";

/** React hook that returns the current unit system and re-renders on change. */
export function useUnits(): UnitSystem {
  const [u, setU] = useState<UnitSystem>(() => getUnitSystem());
  useEffect(() => onUnitSystemChange(setU), []);
  return u;
}
