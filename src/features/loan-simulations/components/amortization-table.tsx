import {
    Table, TableBody, TableCell,
    TableFooter, TableHead, TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { AmortizationResult } from "../domain/amortization-calculator";
import { formatLoanDate } from "./loan-format";

const amount = (value: number) => value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AmortizationTable({ rows, summary }: AmortizationResult) {
    const showInsurance = summary.financedInsurance > 0;
    const showLife = summary.totalLifeInsurance > 0;
    const showCar = summary.totalCarInsurance > 0;
    const totals = rows.reduce((sum, row) => ({
        vehicle: sum.vehicle + row.principalVehicle,
        insurance: sum.insurance + row.principalInsurance,
    }), { vehicle: 0, insurance: 0 });

    return (
        <div className="max-h-128 overflow-auto rounded-2xl border">
            <Table className="tabular-nums">
                <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                        <TableHead className="text-center">No.</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Fecha de pago</TableHead>
                        <TableHead className="text-right">Capital restante</TableHead>
                        <TableHead className="text-right">Capital vehículo</TableHead>
                        {showInsurance && <TableHead className="text-right">Capital seguro</TableHead>}
                        <TableHead className="text-right">Intereses + IVA</TableHead>
                        {showLife && <TableHead className="text-right">Seguro de vida</TableHead>}
                        {showCar && <TableHead className="text-right">Seguro de auto</TableHead>}
                        <TableHead className="text-right">Mensualidad</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="text-muted-foreground">
                        <TableCell className="text-center">0</TableCell>
                        <TableCell colSpan={2}>Inicio</TableCell>
                        <TableCell className="text-right">{amount(summary.financedTotal)}</TableCell>
                        <TableCell colSpan={2 + Number(showInsurance) + Number(showLife) + Number(showCar)} />
                        <TableCell />
                    </TableRow>
                    {rows.map((row) => (
                        <TableRow key={row.sequence}>
                            <TableCell className="text-center">{row.sequence}</TableCell>
                            <TableCell>{formatLoanDate(row.dueDate)}</TableCell>
                            <TableCell className={row.paymentDate !== row.dueDate ? "font-medium text-primary" : undefined}>
                                {formatLoanDate(row.paymentDate)}
                            </TableCell>
                            <TableCell className="text-right">{amount(row.closingBalance)}</TableCell>
                            <TableCell className="text-right">{amount(row.principalVehicle)}</TableCell>
                            {showInsurance && <TableCell className="text-right">{amount(row.principalInsurance)}</TableCell>}
                            <TableCell className="text-right">{amount(row.interest)}</TableCell>
                            {showLife && <TableCell className="text-right">{amount(row.lifeInsurance)}</TableCell>}
                            {showCar && <TableCell className="text-right">{amount(row.carInsurance)}</TableCell>}
                            <TableCell className="text-right font-semibold">{amount(row.payment)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={4} className="font-semibold">Totales</TableCell>
                        <TableCell className="text-right">{amount(totals.vehicle)}</TableCell>
                        {showInsurance && <TableCell className="text-right">{amount(totals.insurance)}</TableCell>}
                        <TableCell className="text-right">{amount(summary.totalInterest)}</TableCell>
                        {showLife && <TableCell className="text-right">{amount(summary.totalLifeInsurance)}</TableCell>}
                        {showCar && <TableCell className="text-right">{amount(summary.totalCarInsurance)}</TableCell>}
                        <TableCell className="text-right font-semibold">{amount(summary.totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}

export function amortizationCsv({ rows, summary }: AmortizationResult) {
    const header = [
        "No.", "Vencimiento", "Fecha de pago", "Capital restante", "Capital vehículo",
        "Capital seguro", "Intereses + IVA", "Seguro de vida", "Seguro de auto", "Mensualidad",
    ];
    const lines = [
        header,
        ["0", "", "", summary.financedTotal.toFixed(2), "", "", "", "", "", ""],
        ...rows.map((row) => [
            String(row.sequence), row.dueDate, row.paymentDate, row.closingBalance.toFixed(2),
            row.principalVehicle.toFixed(2), row.principalInsurance.toFixed(2), row.interest.toFixed(2),
            row.lifeInsurance.toFixed(2), row.carInsurance.toFixed(2), row.payment.toFixed(2),
        ]),
    ];
    return lines.map((line) => line.map((cell) => `"${cell}"`).join(",")).join("\n");
}
