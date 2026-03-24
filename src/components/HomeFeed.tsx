"use client";

import { useEffect, useState } from "react";
import ChangeFeed from "@/components/ChangeFeed";
import { IngredientChange } from "@/lib/supabase";

export default function HomeFeed() {
  const [changes, setChanges] = useState<IngredientChange[] | null>(null);

  useEffect(() => {
    fetch("/api/changes?page=1")
      .then((res) => res.json())
      .then((data) => setChanges(data.changes || []))
      .catch(() => setChanges([]));
  }, []);

  if (changes === null) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <p className="text-lg font-headline">Loading recent changes...</p>
      </div>
    );
  }

  return <ChangeFeed changes={changes} />;
}
