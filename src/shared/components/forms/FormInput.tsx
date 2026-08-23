import { InputHTMLAttributes } from "react";
import { Input } from "../ui/input";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>

export default function FormInput(props: Props) {
    const { className, ...rest } = props

    return (
        <Input
            {...rest}
            className={clsx("h-12 rounded-xl bg-card px-4", className)}
        />
    )
}
