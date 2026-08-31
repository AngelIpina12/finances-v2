import clsx from "clsx";
import {
    Select, SelectContent, SelectGroup,
    SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Option = { label: string; value: string };

type Props = {
    options: readonly Option[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    name?: string;
};

export default function FormSelect({ options, value, onValueChange, placeholder, className, ...props }: Props) {

    return (
        <Select
            {...props}
            value={value || null}
            onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
        >
            <SelectTrigger
                className={clsx("data-[size=default]:h-12 w-full rounded-xl bg-card px-4", className)}
            >
                <SelectValue placeholder={placeholder}>
                    {(selectedValue) =>
                        options.find((option) => option.value === (selectedValue ?? ""))?.label ?? placeholder
                    }
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="p-1.5">
                <SelectGroup>
                    {options.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            className="min-h-10 px-3 py-2"
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
