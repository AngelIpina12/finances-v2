import {
    describe, expect, it
} from "vitest";
import { creditCardPaymentSettingsSchema } from "./credit-card-payment-settings.schema";

const validInput = {
    creditAccountId: "097c1e5d-12fd-4e3d-b1c6-a8d00b7f9354",
    sourceAccountId: "ebefb76c-b357-4d2d-9edb-cbb4dd175cdf",
    strategy: "full_statement" as const,
    paymentTermDays: 20,
    includeInForecast: true,
    billingDate: 24,
};

describe("creditCardPaymentSettingsSchema", () => {
    it.each([
        [0, "El plazo debe ser de al menos 1 día natural."],
        [-2, "El plazo debe ser de al menos 1 día natural."],
        [91, "El plazo no puede ser mayor que 90 días naturales."],
        [20.5, "Ingresa días naturales completos, sin decimales."],
        ["días", "Ingresa una cantidad válida de días naturales."],
    ])("valida en español el plazo %s", (paymentTermDays, expectedMessage) => {
        const result = creditCardPaymentSettingsSchema.safeParse({
            ...validInput,
            paymentTermDays,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(expectedMessage);
        }
    });
});
