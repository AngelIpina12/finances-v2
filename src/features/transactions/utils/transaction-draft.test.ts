import { describe, expect, it } from "vitest";
import { createTransactionDraft } from "./transaction-draft";

const accounts = [{ id: "first" }, { id: "filtered" }];

describe("createTransactionDraft", () => {
    it("prefiere la cuenta elegida desde el filtro", () => {
        expect(createTransactionDraft(accounts, "filtered").accountId).toBe("filtered");
    });

    it("no preselecciona una cuenta cuando el filtro contiene varias", () => {
        expect(createTransactionDraft(accounts, null).accountId).toBe("");
    });

    it("mantiene la primera cuenta como valor predeterminado sin un filtro", () => {
        expect(createTransactionDraft(accounts).accountId).toBe("first");
    });
});
