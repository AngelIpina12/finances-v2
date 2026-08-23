import clsx from 'clsx'
import { FormHTMLAttributes } from 'react'

type Props = FormHTMLAttributes<HTMLFormElement>

export default function Form(props: Props) {
    const { className, ...rest } = props

    return (
        <form className={clsx("flex flex-col gap-5", className)} {...rest}>
            {props.children}
        </form>
    )
}
