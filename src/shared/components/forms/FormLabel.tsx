import { LabelHTMLAttributes } from "react";
import { Label } from "../ui/label";

type Props = LabelHTMLAttributes<HTMLLabelElement>

export default function FormLabel(props: Props) {
    return (
        <Label htmlFor={props.htmlFor}>{props.children}</Label>
    )
}
