import clsx from "clsx"
import { ButtonHTMLAttributes } from "react"
import { Button } from "../ui/button"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function FormSubmit(props: Props) {
    const { className, ...rest } = props

    return (
        <Button
            type="submit"
            className={clsx("h-12 w-full rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 cursor-pointer", className)}
            {...rest}
        >
            {props.children}
        </Button>
    )
}
