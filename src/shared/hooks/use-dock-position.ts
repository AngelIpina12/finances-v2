"use client";

import { useSyncExternalStore } from "react";
import {
    DEFAULT_DOCK_BACKGROUND,
    DEFAULT_DOCK_POSITION,
    DOCK_AUTOHIDE_STORAGE_KEY,
    DOCK_BACKGROUND_STORAGE_KEY,
    DOCK_BLUR,
    DOCK_BLUR_STORAGE_KEY,
    DOCK_MAGNIFICATION,
    DOCK_MAGNIFICATION_STORAGE_KEY,
    DOCK_STORAGE_KEY,
    DOCK_TRANSPARENCY,
    DOCK_TRANSPARENCY_STORAGE_KEY,
    isDockBackground,
    isDockPosition,
    parseDockRange,
    type DockBackground,
    type DockPosition,
} from "@/src/shared/constants/dock";

const DOCK_CHANGE_EVENT = "finances:dock-change";

function getStoredDockPosition(): DockPosition {
    try {
        const stored = localStorage.getItem(DOCK_STORAGE_KEY);
        return isDockPosition(stored) ? stored : DEFAULT_DOCK_POSITION;
    } catch {
        return DEFAULT_DOCK_POSITION;
    }
}

function getServerDockPosition(): DockPosition {
    return DEFAULT_DOCK_POSITION;
}

function subscribeToDockPosition(onChange: () => void) {
    // Mantiene los atributos sincronizados también cuando cambian desde otra pestaña
    const handleChange = () => {
        document.documentElement.dataset.dock = getStoredDockPosition();
        applyDockAutohide(getStoredDockAutohide());
        applyDockBackground(getStoredDockBackground());
        applyDockTransparency(getStoredDockTransparency());
        applyDockBlur(getStoredDockBlur());
        onChange();
    };

    window.addEventListener("storage", handleChange);
    window.addEventListener(DOCK_CHANGE_EVENT, handleChange);

    return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(DOCK_CHANGE_EVENT, handleChange);
    };
}

export function setDockPosition(position: DockPosition) {
    try {
        localStorage.setItem(DOCK_STORAGE_KEY, position);
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    document.documentElement.dataset.dock = position;
    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockPosition() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockPosition,
        getServerDockPosition,
    );
}

function getStoredDockMagnification(): number {
    try {
        return parseDockRange(localStorage.getItem(DOCK_MAGNIFICATION_STORAGE_KEY), DOCK_MAGNIFICATION);
    } catch {
        return DOCK_MAGNIFICATION.default;
    }
}

function getServerDockMagnification(): number {
    return DOCK_MAGNIFICATION.default;
}

export function setDockMagnification(magnification: number) {
    try {
        localStorage.setItem(DOCK_MAGNIFICATION_STORAGE_KEY, String(magnification));
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockMagnification() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockMagnification,
        getServerDockMagnification,
    );
}

function getStoredDockAutohide(): boolean {
    try {
        return localStorage.getItem(DOCK_AUTOHIDE_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

function getServerDockAutohide(): boolean {
    return false;
}

function applyDockAutohide(autohide: boolean) {
    if (autohide) document.documentElement.dataset.dockAutohide = "";
    else delete document.documentElement.dataset.dockAutohide;
}

export function setDockAutohide(autohide: boolean) {
    try {
        localStorage.setItem(DOCK_AUTOHIDE_STORAGE_KEY, String(autohide));
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    applyDockAutohide(autohide);
    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockAutohide() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockAutohide,
        getServerDockAutohide,
    );
}

function getStoredDockBackground(): DockBackground {
    try {
        const stored = localStorage.getItem(DOCK_BACKGROUND_STORAGE_KEY);
        return isDockBackground(stored) ? stored : DEFAULT_DOCK_BACKGROUND;
    } catch {
        return DEFAULT_DOCK_BACKGROUND;
    }
}

function getServerDockBackground(): DockBackground {
    return DEFAULT_DOCK_BACKGROUND;
}

function applyDockBackground(background: DockBackground) {
    document.documentElement.dataset.dockBackground = background;
}

export function setDockBackground(background: DockBackground) {
    try {
        localStorage.setItem(DOCK_BACKGROUND_STORAGE_KEY, background);
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    applyDockBackground(background);
    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockBackground() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockBackground,
        getServerDockBackground,
    );
}

function getStoredDockTransparency(): number {
    try {
        return parseDockRange(localStorage.getItem(DOCK_TRANSPARENCY_STORAGE_KEY), DOCK_TRANSPARENCY);
    } catch {
        return DOCK_TRANSPARENCY.default;
    }
}

function getServerDockTransparency(): number {
    return DOCK_TRANSPARENCY.default;
}

function applyDockTransparency(transparency: number) {
    document.documentElement.style.setProperty("--dock-opacity", `${100 - transparency}%`);
}

export function setDockTransparency(transparency: number) {
    try {
        localStorage.setItem(DOCK_TRANSPARENCY_STORAGE_KEY, String(transparency));
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    applyDockTransparency(transparency);
    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockTransparency() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockTransparency,
        getServerDockTransparency,
    );
}

function getStoredDockBlur(): number {
    try {
        return parseDockRange(localStorage.getItem(DOCK_BLUR_STORAGE_KEY), DOCK_BLUR);
    } catch {
        return DOCK_BLUR.default;
    }
}

function getServerDockBlur(): number {
    return DOCK_BLUR.default;
}

function applyDockBlur(blur: number) {
    document.documentElement.style.setProperty("--dock-blur", `${blur}px`);
}

export function setDockBlur(blur: number) {
    try {
        localStorage.setItem(DOCK_BLUR_STORAGE_KEY, String(blur));
    } catch {
        // Sin storage, al menos se aplica en la sesión actual.
    }

    applyDockBlur(blur);
    window.dispatchEvent(new Event(DOCK_CHANGE_EVENT));
}

export function useDockBlur() {
    return useSyncExternalStore(
        subscribeToDockPosition,
        getStoredDockBlur,
        getServerDockBlur,
    );
}
