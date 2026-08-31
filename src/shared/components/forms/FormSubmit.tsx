import { Button } from "@/src/shared/components/ui/button";
import clsx from "clsx"
import { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function FormSubmit(props: Props) {
    const { className, ...rest } = props

    return (
        <Button
            type="submit"
            className={clsx("h-12 rounded-xl shadow-lg shadow-accent/20 cursor-pointer", className)}
            {...rest}
        >
            {props.children}
        </Button>
    )
}
