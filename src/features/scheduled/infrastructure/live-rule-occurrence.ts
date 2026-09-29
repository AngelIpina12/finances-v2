import { sql } from "drizzle-orm";
import { recurringRules, scheduledOccurrences } from "@/src/db/schema";

// Las ocurrencias ya generadas de una recurrencia pausada o archivada siguen
// en la tabla; las lecturas de compromisos futuros deben ignorarlas.
export const occurrenceHasLiveRule = sql`(
    ${scheduledOccurrences.recurringRuleId} is null
    or exists (
        select 1 from ${recurringRules}
        where ${recurringRules.id} = ${scheduledOccurrences.recurringRuleId}
            and ${recurringRules.isActive} = true
            and ${recurringRules.deletedAt} is null
    )
)`;
