UPDATE "financial_accounts"
SET "current_balance" = 0
WHERE "name" IN (
    'Didi Cuenta Débito',
    'Revolut Débito',
    'Mercado Pago Débito',
    'Nu Débito'
)
  AND "type" = 'debit';
