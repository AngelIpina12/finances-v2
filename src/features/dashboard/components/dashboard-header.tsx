"use client";

import { motion } from "framer-motion";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ userName }: { userName?: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Resumen</h1><p className="mt-1 text-muted-foreground">{greeting}{userName ? `, ${userName.split(" ")[0]}` : ""}. Aquí está tu panorama financiero de agosto.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline">Este mes<ChevronDown /></Button><Button><Plus />Agregar transacción</Button></div></motion.header>;
}
