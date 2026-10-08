import { sql } from "drizzle-orm";
import { recurringRules, scheduledOccurrences } from "@/src/db/schema";

export const occurrenceHasLiveRule = sql`(
    ${scheduledOccurrences.recurringRuleId} is null
    or exists (
        select 1 from ${recurringRules}
        where ${recurringRules.id} = ${scheduledOccurrences.recurringRuleId}
            and ${recurringRules.isActive} = true
            and ${recurringRules.deletedAt} is null
    )
)`;
