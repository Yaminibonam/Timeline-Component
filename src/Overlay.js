// Overlay component for Timeline
import React from "react";
import { secondsToMMSS } from "./utils";

const MARKER_TYPES = {
    ad: { color: "#1777ff" },
    skip: { color: "#8b5cf6" },
    chapter: { color: "#888" },
    autoplay: { color: "#888" },
};

export default function Overlay({ overlay, idx, onPointerDown, onResizeLeft, onResizeRight, onDelete }) {
    const color = MARKER_TYPES[overlay.type]?.color || "#888";
    const left = overlay.left;
    const width = overlay.width;
    return (
        <div
            className={`overlay ${overlay.type}`}
            style={{
                position: "absolute",
                left,
                top: 0,
                width,
                height: 32,
                background: color + (overlay.addedByForm ? "66" : "33"),
                border: `2px solid ${color}`,
                borderRadius: 6,
                zIndex: 0,
                cursor: "move",
                display: "flex",
                alignItems: "center",
                pointerEvents: "auto",
                userSelect: "none",
                outline: overlay.addedByForm ? `2px solid ${color}` : undefined,
            }}
            title={`${overlay.type}: ${secondsToMMSS(overlay.startSeconds)} - ${secondsToMMSS(overlay.endSeconds)}`}
            onPointerDown={onPointerDown}
        >
            <div
                className="resize-handle left"
                style={{
                    width: 8,
                    height: 28,
                    cursor: "ew-resize",
                    position: "absolute",
                    left: -4,
                    top: 2,
                    zIndex: 2,
                    background: color + "55",
                    borderRadius: 4,
                }}
                onPointerDown={onResizeLeft}
            />
            <span style={{ margin: "0 auto", fontWeight: 600, color }}>{overlay.type}</span>
            <div
                className="resize-handle right"
                style={{
                    width: 8,
                    height: 28,
                    cursor: "ew-resize",
                    position: "absolute",
                    right: -4,
                    top: 2,
                    zIndex: 2,
                    background: color + "55",
                    borderRadius: 4,
                }}
                onPointerDown={onResizeRight}
            />
            <div
                className="overlay-delete"
                style={{ position: "absolute", right: 8, top: 4, cursor: "pointer", color: "#c00", fontWeight: 700, zIndex: 3 }}
                onClick={onDelete}
                title="Delete overlay"
            >
                ✖
            </div>
        </div>
    );
}
