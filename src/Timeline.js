import { useRef, useState, useEffect, useCallback } from "react";
import "./Timeline.css";
import { secondsToMMSS } from "./utils";
import Marker from "./Marker";
import Overlay from "./Overlay";
import Controls from "./Controls";

const MARKER_TYPES = {
  ad: { color: "#1777ff", label: "Ad", icon: "📢" },
  skip: { color: "#8b5cf6", label: "Skip", icon: "⏭️" },
  chapter: { color: "#888", label: "Chapter", icon: "📖" },
  autoplay: { color: "#898686ff", label: "Autoplay", icon: "▶️" },
};

export default function Timeline({ timelineLength, markers: propMarkers = [], overlays: propOverlays = [] }) {
  const timelineWidthSeconds = typeof timelineLength === 'number' ? timelineLength : 60 * 60 * 5;
  const timelineRef = useRef(null);
  const rulerRef = useRef(null);
  const containerRef = useRef(null);

  const getInitialPixelsPerSecond = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64;
      return Math.max(screenWidth / timelineWidthSeconds, 1);
    }
    return 1;
  };

  const getMinPixelsPerSecond = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64;
      return screenWidth / timelineWidthSeconds;
    }
    return 1;
  };

  const [pixelsPerSecond, setPixelsPerSecond] = useState(getInitialPixelsPerSecond);
  const [markers, setMarkers] = useState(propMarkers);
  const [overlays, setOverlays] = useState(propOverlays);
  const [selectedType, setSelectedType] = useState("ad");
  const [draggingMarker, setDraggingMarker] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [resizeOverlay, setResizeOverlay] = useState(null);
  const [overlayInput, setOverlayInput] = useState({ type: "chapter", start: "", end: "" });
  const [recentlyDragged, setRecentlyDragged] = useState(false);

  const secondsToPx = s => Math.round(s * pixelsPerSecond);
  const pxToSeconds = px => px / pixelsPerSecond;

  useEffect(() => { setMarkers(propMarkers); }, [propMarkers]);
  useEffect(() => { setOverlays(propOverlays); }, [propOverlays]);

  useEffect(() => {
    const minPPS = getMinPixelsPerSecond();
    setPixelsPerSecond(p => Math.max(p, minPPS));
  }, [timelineLength]);

  // ----------------- Zoom via Mouse Wheel -----------------
  const handleWheel = (event) => {
    event.preventDefault();
    const factor = 1.2; // zoom multiplier
    const minPPS = getMinPixelsPerSecond();
    const screenWidth = window.innerWidth - 64;

    if (event.deltaY < 0) {
      setPixelsPerSecond(p => Math.min(p * factor, screenWidth));
    } else {
      setPixelsPerSecond(p => Math.max(p / factor, minPPS));
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, []);

  // ----------------- Overlay & Marker Add -----------------
  const handleAddOverlay = (e) => {
    e.preventDefault();
    const { type, start, end } = overlayInput;
    const [sm, ss] = start.split(":").map(Number);
    const [em, es] = end.split(":").map(Number);
    let startSec = sm * 60 + (ss || 0);
    let endSec = em * 60 + (es || 0);
    if (type !== "chapter" && type !== "autoplay") return;
    if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) return;
    if (endSec > timelineWidthSeconds) endSec = timelineWidthSeconds;
    if (startSec >= timelineWidthSeconds) startSec = timelineWidthSeconds - 1;

    const duplicate = overlays.some(ov => ov.type === type && Math.round(ov.startSeconds) === Math.round(startSec) && Math.round(ov.endSeconds) === Math.round(endSec));
    if (duplicate) { alert("An overlay of this type and time already exists."); return; }

    setOverlays(prev => [...prev, { id: prev.length ? Math.max(...prev.map(o => o.id)) + 1 : 1, type, startSeconds: startSec, endSeconds: endSec, addedByForm: true }]);
    setOverlayInput({ type: "chapter", start: "", end: "" });
  };

  const onRulerClick = (e) => {
    if (recentlyDragged || draggingMarker || dragOverlay || resizeOverlay ||
        e.target.closest(".overlay") || e.target.closest(".marker")) return;
    if (selectedType !== "ad" && selectedType !== "skip") return;

    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
    const seconds = Math.max(0, pxToSeconds(x));

    const duplicate = markers.some(m => m.type === selectedType && Math.round(m.seconds) === Math.round(seconds));
    if (duplicate) { alert("A marker of this type already exists at this time."); return; }

    setMarkers(prev => [...prev, { id: prev.length ? Math.max(...prev.map(m => m.id)) + 1 : 1, seconds, type: selectedType }]);
  };

  // ----------------- Drag & Resize Handlers -----------------
  const onPointerMove = useCallback((e) => {
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;

    if (draggingMarker) {
      setMarkers(list => list.map(m => m.id === draggingMarker.id ? { ...m, seconds: Math.max(0, pxToSeconds(x - draggingMarker.offset)) } : m));
    } else if (dragOverlay) {
      setOverlays(prev => prev.map((ov,i) => i === dragOverlay.idx ? {...ov, startSeconds: Math.max(0, pxToSeconds(x - dragOverlay.offset)), endSeconds: ov.endSeconds - ov.startSeconds + Math.max(0, pxToSeconds(x - dragOverlay.offset)) } : ov));
    } else if (resizeOverlay) {
      setOverlays(prev => prev.map((ov,i) => {
        if (i !== resizeOverlay.idx) return ov;
        if (resizeOverlay.edge === "left") return { ...ov, startSeconds: Math.min(Math.max(pxToSeconds(x),0), ov.endSeconds-1) };
        else return { ...ov, endSeconds: Math.max(pxToSeconds(x), ov.startSeconds+1) };
      }));
    }
  }, [draggingMarker, dragOverlay, resizeOverlay]);

  const onPointerUp = useCallback(() => {
    if (draggingMarker || dragOverlay || resizeOverlay) {
      setRecentlyDragged(true);
      setTimeout(() => setRecentlyDragged(false), 50);
    }
    setDraggingMarker(null);
    setDragOverlay(null);
    setResizeOverlay(null);
  }, [draggingMarker, dragOverlay, resizeOverlay]);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ----------------- Zoom Buttons -----------------
  const zoomIn = () => {
    const screenWidth = window.innerWidth - 64;
    setPixelsPerSecond(p => Math.min(p * 1.2, screenWidth));
  };
  const zoomOut = () => {
    const minPPS = getMinPixelsPerSecond();
    setPixelsPerSecond(p => Math.max(p / 1.2, minPPS));
  };

  const removeMarker = id => setMarkers(prev => prev.filter(m => m.id !== id));
  const removeOverlay = idx => setOverlays(prev => prev.filter((_,i)=>i!==idx));

  const ticks = (() => {
    const desiredPx = 80;
    const secondsPerTickBase = Math.max(1, desiredPx / Math.max(pixelsPerSecond,0.00001));
    const nice = [1,5,10,15,30,60,120,300,600,900,1800,3600,7200,14400];
    const secondsPerTick = nice.reduce((prev, cur) => Math.abs(cur - secondsPerTickBase) < Math.abs(prev - secondsPerTickBase) ? cur : prev);
    const ticks = [];
    for(let s=0; s<=timelineWidthSeconds; s+=secondsPerTick){
      const left = secondsToPx(s);
      ticks.push({s,left});
      if(ticks.length>20000) break;
    }
    return ticks;
  })();

  const getTimelineWidthPx = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64;
      const px = secondsToPx(timelineWidthSeconds);
      return Math.max(px, screenWidth);
    }
    return secondsToPx(timelineWidthSeconds);
  };

  return (
    <div className="page">
      <Controls
        overlayInput={overlayInput}
        setOverlayInput={setOverlayInput}
        handleAddOverlay={handleAddOverlay}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        pixelsPerSecond={pixelsPerSecond}
      />
      <div className="ruler-wrapper" ref={timelineRef}>
        <div
          ref={containerRef}
          className="timeline-container"
          style={{
            height: "100px",
            whiteSpace: "nowrap",
          }}
        >
          <div
            className="ruler"
            ref={rulerRef}
            style={{ width: getTimelineWidthPx() }}
            onClick={onRulerClick}
          >
            <div className="ticks">
              {ticks.map((t, idx) => (
                <div key={idx} className="tick" style={{ left: t.left }}>
                  <div className="label">{secondsToMMSS(t.s)}</div>
                </div>
              ))}
            </div>
            <div className="baseline" />
            {overlays.map((ov, idx) => (
              <Overlay
                key={ov.id || idx}
                overlay={{ ...ov, left: secondsToPx(ov.startSeconds), width: secondsToPx(ov.endSeconds - ov.startSeconds) }}
                idx={idx}
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - secondsToPx(ov.startSeconds);
                  setDragOverlay({ idx, offset });
                }}
                onResizeLeft={e => { e.stopPropagation(); setResizeOverlay({ idx, edge: "left" }); }}
                onResizeRight={e => { e.stopPropagation(); setResizeOverlay({ idx, edge: "right" }); }}
                onDelete={() => removeOverlay(idx)}
              />
            ))}
            <div className="markers-layer">
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  marker={{ ...m, left: secondsToPx(m.seconds) }}
                  onPointerDown={e => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - secondsToPx(m.seconds);
                    setDraggingMarker({ id: m.id, offset });
                  }}
                  onDelete={e => { e.stopPropagation(); removeMarker(m.id); }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hint">
        Click to add marker or overlay. Drag to move. Resize overlays by dragging the edges. Use the form above to add overlays for chapter/autoplay.
      </div>
    </div>
  );
}
