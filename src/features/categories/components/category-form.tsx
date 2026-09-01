"use client";

import { useTransition } from "react";
import {
    Controller, Resolver, useForm,
    useWatch
} from "react-hook-form";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { saveCategory } from "../actions/category-actions";
import { CATEGORY_ICON_LABELS, categoryColors } from "../constants/category.constants";
import { categoryIconKeys, type CategoryType } from "../domain/category-repository";
import { categoryFormSchema, type CategoryFormData } from "../schemas/category.schema";

interface Props {
    initialValues: CategoryFormData;
    typeLocked?: boolean;
    onClose: () => void;
}

export function CategoryForm({ initialValues, typeLocked = false, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, formState: { errors },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categoryFormSchema) as Resolver<CategoryFormData>,
        defaultValues: initialValues,
        mode: "all",
    });
    const type = useWatch({ control, name: "type" });
    const color = useWatch({ control, name: "color" });

    function changeType(nextType: CategoryType) {
        setValue("type", nextType, { shouldDirty: true });
    }

    function onSubmit(data: CategoryFormData) {
        startTransition(async () => {
            const result = await saveCategory(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    return (
        <Form onSubmit={handleSubmit(onSubmit)}>
            <SegmentedControl
                items={["expense", "income"] as const}
                labels={{ expense: "Gasto", income: "Ingreso" }}
                value={type}
                onChange={changeType}
                disabled={typeLocked}
            />
            {typeLocked && (
                <p className="-mt-4 text-xs text-muted-foreground">
                    El tipo no puede cambiar porque esta categoría ya tiene movimientos.
                </p>
            )}

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="category-name">Nombre</FormLabel>
                <FormInput
                    id="category-name"
                    placeholder="Ej. Mascotas"
                    autoFocus
                    {...register("name")}
                />
                {errors.name && <FormError>{errors.name.message}</FormError>}
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="category-icon">Icono</FormLabel>
                <Controller
                    name="icon"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            options={categoryIconKeys.map((icon) => ({
                                value: icon,
                                label: CATEGORY_ICON_LABELS[icon],
                            }))}
                        />
                    )}
                />
                {errors.icon && <FormError>{errors.icon.message}</FormError>}
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <FormLabel>Color</FormLabel>
                    <span className="text-xs text-muted-foreground">{color}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {categoryColors.map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-label={`Elegir color ${option}`}
                            onClick={() => setValue("color", option, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })}
                            className={`size-8 cursor-pointer rounded-full ring-offset-2 transition ${color === option ? "ring-2 ring-foreground" : "hover:scale-110"}`}
                            style={{ backgroundColor: option }}
                        />
                    ))}
                    <label
                        className="relative size-8 cursor-pointer rounded-full bg-[conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)] shadow-sm transition hover:scale-110"
                        title="Elegir un color personalizado"
                    >
                        <FormInput
                            type="color"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            aria-label="Elegir un color personalizado"
                            {...register("color")}
                        />
                    </label>
                </div>
                {errors.color && <FormError>{errors.color.message}</FormError>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="cursor-pointer"
                >
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending}>
                    {isPending
                        ? "Guardando..."
                        : initialValues.id
                            ? "Guardar cambios"
                            : "Crear categoría"}
                </FormSubmit>
            </div>
        </Form>
    );
}
