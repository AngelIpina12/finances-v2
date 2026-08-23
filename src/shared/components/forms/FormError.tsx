export default function FormError({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-1.5 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {children}
        </p>
    )
}
