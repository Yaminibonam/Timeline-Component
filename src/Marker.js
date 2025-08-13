// Marker component for Timeline
import React from "react";
import { secondsToMMSS } from "./utils";

const MARKER_TYPES = {
    ad: { color: "#1777ff", label: "Ad", icon: "📢" },
    skip: { color: "#8b5cf6", label: "Skip", icon: "⏭️" },
};

export default function Marker({ marker, onPointerDown, onDelete }) {
    const left = marker.left;
    const def = MARKER_TYPES[marker.type] || MARKER_TYPES.ad;
    return (
        <div
            className="marker"
            style={{ left, cursor: "move" }}
            onPointerDown={onPointerDown}
        >
            <div className="marker-pin" style={{ background: def.color }}>
                <span className="marker-icon">{def.icon}</span>
            </div>
            <div className="marker-time">{secondsToMMSS(marker.seconds)}</div>
            <div
                className="marker-delete"
                style={{ position: "absolute", right: -10, top: -10, cursor: "pointer", color: "#c00", fontWeight: 700, zIndex: 3 }}
                onClick={onDelete}
                title="Delete marker"
            >
                ✖
            </div>
        </div>
    );
}
