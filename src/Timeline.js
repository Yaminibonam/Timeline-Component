import { useRef, useState, useEffect, useCallback } from "react";
import "./Timeline.css";
import { fetchTable, saveRecord, deleteRecord } from "./api";
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

// ----------------- Timeline Component -----------------
export default function Timeline({ timelineLength, videoID }) {
  // Use dynamic timeline length from prop
  const timelineWidthSeconds = typeof timelineLength === 'number' ? timelineLength : 60 * 60 * 5;
  const timelineRef = useRef(null);
  const rulerRef = useRef(null);

  // Calculate initial pixelsPerSecond so timeline fits screen width
  const getInitialPixelsPerSecond = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64; // 64px padding estimate
      return Math.max(screenWidth / timelineWidthSeconds, 1);
    }
    return 1;
  };

  const [pixelsPerSecond, setPixelsPerSecond] = useState(getInitialPixelsPerSecond);
  const [markers, setMarkers] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [selectedType, setSelectedType] = useState("ad");
  const [draggingMarker, setDraggingMarker] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [resizeOverlay, setResizeOverlay] = useState(null);
  const [overlayInput, setOverlayInput] = useState({ type: "chapter", start: "", end: "" });
  const [recentlyDragged, setRecentlyDragged] = useState(false);

  // Always keep timeline at least screen width
  const getMinPixelsPerSecond = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64;
      return screenWidth / timelineWidthSeconds;
    }
    return 1;
  };

  useEffect(() => {
    // If video length changes, recalc zoom so timeline fits screen
    const minPPS = getMinPixelsPerSecond();
    setPixelsPerSecond(p => Math.max(p, minPPS));
  }, [timelineLength]);

  const secondsToPx = s => Math.round(s * pixelsPerSecond);
  const pxToSeconds = px => px / pixelsPerSecond;

  // ----------------- Load markers & overlays -----------------
  useEffect(() => {
    if (!videoID) return;
    (async () => {
      try {
        const markerRows = await fetchTable("markers");
        const overlayRows = await fetchTable("overlays");

        setMarkers(markerRows.filter(r => r.videoID === videoID).map(r => ({
          id: r.id,
          seconds: Number(r.seconds),
          type: r.type
        })));

        setOverlays(overlayRows.filter(r => r.videoID === videoID).map(r => ({
          id: r.id,
          type: r.type,
          startSeconds: Number(r.startSeconds),
          endSeconds: Number(r.endSeconds),
          addedByForm: false
        })));
      } catch (err) {
        console.error("Failed to load from API:", err);
      }
    })();
  }, [videoID]);

  // ----------------- Add Overlay -----------------
  const handleAddOverlay = (e) => {
    e.preventDefault();
    const { type, start, end } = overlayInput;
    const [sm, ss] = start.split(":").map(Number);
    const [em, es] = end.split(":").map(Number);
    let startSec = sm * 60 + (ss || 0);
    let endSec = em * 60 + (es || 0);
    if (type !== "chapter" && type !== "autoplay") return;
    if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) return;
    // Prevent overlay from exceeding video length
    if (endSec > timelineWidthSeconds) {
      alert("Overlay end time exceeds video length.");
      endSec = timelineWidthSeconds;
    }
    if (startSec >= timelineWidthSeconds) {
      alert("Overlay start time exceeds video length.");
      startSec = timelineWidthSeconds - 1;
    }

    // Prevent duplicate overlay of same type, start, and end
    const duplicate = overlays.some(ov => ov.type === type && Math.round(ov.startSeconds) === Math.round(startSec) && Math.round(ov.endSeconds) === Math.round(endSec));
    if (duplicate) {
      alert("An overlay of this type and time already exists.");
      return;
    }
    saveRecord("overlays",
      ["startSeconds","endSeconds","type","videoID"],
      [startSec, endSec, type, videoID]
    ).then(() => {
      // Fetch updated overlays from backend
      fetchTable("overlays").then(overlayRows => {
        setOverlays(overlayRows.filter(r => r.videoID === videoID).map(r => ({
          id: r.id,
          type: r.type,
          startSeconds: Number(r.startSeconds),
          endSeconds: Number(r.endSeconds),
          addedByForm: false
        })));
      });
    }).catch(err => console.error("Failed to save overlay", err));
    setOverlayInput({ type: "chapter", start: "", end: "" });
  };

  // ----------------- Add Marker -----------------
  const onRulerClick = (e) => {
    if (recentlyDragged || draggingMarker || dragOverlay || resizeOverlay ||
        e.target.closest(".overlay") || e.target.closest(".marker")) return;
    if (selectedType !== "ad" && selectedType !== "skip") return;

    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
    const seconds = Math.max(0, pxToSeconds(x));
    // Prevent duplicate marker of same type at same time
    const duplicate = markers.some(m => m.type === selectedType && Math.round(m.seconds) === Math.round(seconds));
    if (duplicate) {
      alert("A marker of this type already exists at this time.");
      return;
    }
    saveRecord("markers", ["seconds","type","videoID"], [seconds, selectedType, videoID])
      .then(() => {
        // Fetch updated markers from backend
        fetchTable("markers").then(markerRows => {
          setMarkers(markerRows.filter(r => r.videoID === videoID).map(r => ({
            id: r.id,
            seconds: Number(r.seconds),
            type: r.type
          })));
        });
      })
      .catch(err => console.error("Failed to save marker", err));
  };

  // ----------------- Pointer Move & Up -----------------
  const onPointerMove = useCallback((e) => {
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;

    if (draggingMarker) {
      setMarkers(list => {
        const updated = list.map(m =>
          m.id === draggingMarker.id ? { ...m, seconds: Math.max(0, pxToSeconds(x - draggingMarker.offset)) } : m
        );
        // Prevent duplicate marker of same type at new time
        const moved = updated.find(m => m.id === draggingMarker.id);
        if (moved) {
          const duplicate = updated.some(m => m.id !== moved.id && m.type === moved.type && Math.round(m.seconds) === Math.round(moved.seconds));
          if (duplicate) {
            alert("A marker of this type already exists at this time.");
            // Just return previous state, do NOT trigger any more setMarkers or backend calls
            return list;
          }
          // Only update backend and fetch if not duplicate
          saveRecord("markers", ["id","seconds","type","videoID"], [moved.id, moved.seconds, moved.type, videoID])
            .then(() => {
              fetchTable("markers").then(markerRows => {
                setMarkers(markerRows.filter(r => r.videoID === videoID).map(r => ({
                  id: r.id,
                  seconds: Number(r.seconds),
                  type: r.type
                })));
              });
            })
            .catch(err => console.error("Failed to update marker", err));
        }
        return updated;
      });
    } else if (dragOverlay) {
      setOverlays(prev => {
        const updated = prev.map((ov, i) => {
          if (i !== dragOverlay.idx) return ov;
          const width = ov.endSeconds - ov.startSeconds;
          let newStart = pxToSeconds(x - dragOverlay.offset);
          newStart = Math.max(0, Math.min(newStart, timelineWidthSeconds - width));
          let newEnd = newStart + width;
          // Prevent overlay from exceeding video length
          if (newEnd > timelineWidthSeconds) {
            alert("Overlay end time exceeds video length.");
            newEnd = timelineWidthSeconds;
            newStart = newEnd - width;
          }
          const newOv = { ...ov, startSeconds: newStart, endSeconds: newEnd };
          saveRecord("overlays",
            ["id","startSeconds","endSeconds","type","videoID"],
            [newOv.id,newOv.startSeconds,newOv.endSeconds,newOv.type,videoID]
          ).catch(err => console.error("Failed to save overlay", err));
          return newOv;
        });
        return updated;
      });
    } else if (resizeOverlay) {
      setOverlays(prev => {
        const updated = prev.map((ov,i) => {
          if (i !== resizeOverlay.idx) return ov;
          let newStart = ov.startSeconds;
          let newEnd = ov.endSeconds;
          if (resizeOverlay.edge === "left") newStart = Math.min(Math.max(pxToSeconds(x),0), ov.endSeconds-1);
          else if (resizeOverlay.edge === "right") newEnd = Math.max(pxToSeconds(x), ov.startSeconds+1);
          // Prevent overlay from exceeding video length
          if (newEnd > timelineWidthSeconds) {
            alert("Overlay end time exceeds video length.");
            newEnd = timelineWidthSeconds;
          }
          if (newStart >= timelineWidthSeconds) {
            alert("Overlay start time exceeds video length.");
            newStart = timelineWidthSeconds - 1;
          }
          const newOv = { ...ov, startSeconds: newStart, endSeconds: newEnd };
          saveRecord("overlays",
            ["id","startSeconds","endSeconds","type","videoID"],
            [newOv.id,newOv.startSeconds,newOv.endSeconds,newOv.type,videoID]
          ).catch(err => console.error("Failed to save overlay", err));
          return newOv;
        });
        return updated;
      });
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

  // ----------------- Zoom & Delete -----------------
  // Limit zoom in so that 1 second fills the screen width at maximum
  const zoomIn = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth - 64;
      setPixelsPerSecond(p => Math.min(p * 1.6, screenWidth));
    } else {
      setPixelsPerSecond(p => Math.min(p * 1.6, 5));
    }
  };
  const zoomOut = () => {
    const minPPS = getMinPixelsPerSecond();
    setPixelsPerSecond(p => Math.max(p/1.6, minPPS));
  };

  const removeMarker = id => {
    setMarkers(prev => prev.filter(m => m.id !== id));
    deleteRecord("markers", "id", id).catch(err => console.error("Failed to delete marker", err));
  };

  const removeOverlay = idx => {
    const ov = overlays[idx];
    setOverlays(prev => prev.filter((_,i)=>i!==idx));
    if (ov?.id) deleteRecord("overlays", "id", ov.id).catch(err => console.error("Failed to delete overlay", err));
  };

  // ----------------- Ticks -----------------
  const ticks = (() => {
    const desiredPx = 80;
    const secondsPerTickBase = Math.max(1, desiredPx / Math.max(pixelsPerSecond,0.00001));
    const nice = [1,5,10,15,30,60,120,300,600,900,1800,3600,7200,14400];
    const secondsPerTick = nice.reduce((prev, cur) =>
      Math.abs(cur - secondsPerTickBase) < Math.abs(prev - secondsPerTickBase) ? cur : prev
    );
    const ticks = [];
    for(let s=0; s<=timelineWidthSeconds; s+=secondsPerTick){
      const left = secondsToPx(s);
      ticks.push({s,left});
      if(ticks.length>20000) break;
    }
    return ticks;
  })();

  // ----------------- Render -----------------
  // Calculate timeline width so it never goes below screen width
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
              overlay={{
                ...ov,
                left: secondsToPx(ov.startSeconds),
                width: secondsToPx(ov.endSeconds - ov.startSeconds),
              }}
              idx={idx}
              onPointerDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
                const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - secondsToPx(ov.startSeconds);
                setDragOverlay({ idx, offset });
              }}
              onResizeLeft={e => {
                e.stopPropagation();
                setResizeOverlay({ idx, edge: "left" });
              }}
              onResizeRight={e => {
                e.stopPropagation();
                setResizeOverlay({ idx, edge: "right" });
              }}
              onDelete={() => removeOverlay(idx)}
            />
          ))}
          <div className="markers-layer">
            {markers.map((m) => (
              <Marker
                key={m.id}
                marker={{
                  ...m,
                  left: secondsToPx(m.seconds),
                }}
                onPointerDown={e => {
                  e.stopPropagation();
                  if (e.button !== 0) return;
                  const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - secondsToPx(m.seconds);
                  setDraggingMarker({ id: m.id, offset });
                }}
                onDelete={e => {
                  e.stopPropagation();
                  removeMarker(m.id);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="hint">
        Click to add marker or overlay. Drag to move. Resize overlays by dragging the edges. Use the form above to add overlays for chapter/autoplay.
      </div>
    </div>
  );
}