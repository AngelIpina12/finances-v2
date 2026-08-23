import clsx from "clsx"
import { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function ActionLink(props: Props) {
    const { className, ...rest } = props

    return (
        <button
            type="button"
            className={clsx("text-accent-foreground hover:underline cursor-pointer", className)}
            {...rest}
        />
    )
}
