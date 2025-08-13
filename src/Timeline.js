import { useRef, useState, useEffect, useCallback } from "react";
import "./Timeline.css";

const MARKER_TYPES = {
    ad: { color: "#1777ff", label: "Ad", icon: "📢" },
    skip: { color: "#8b5cf6", label: "Skip", icon: "⏭️" },
};

const API_BASE = "http://138.68.140.83:8080/yaminib";

// ----------------- API Helpers -----------------
async function fetchTable(tableName) {
    const res = await fetch(`${API_BASE}/getTableData.jsp?tableName=${tableName}`);
    if (!res.ok) throw new Error(`Failed to fetch ${tableName}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (!Array.isArray(json.columns) || !Array.isArray(json.data)) return [];
    
    return json.data.map(row => {
        const obj = {};
        json.columns.forEach((colName, idx) => {
            obj[colName] = row[idx];
        });
        return obj;
    });
}

async function saveRecord(tableName, columns, values) {
    // Send columns[] and values[] as arrays, matching backend JSP requirements
    const params = new URLSearchParams();
    params.append("tableName", tableName);
    columns.forEach(c => params.append("columns[]", c));
    values.forEach(v => params.append("values[]", v));
    
    const res = await fetch(`${API_BASE}/saveRecord.jsp`, {
        method: "POST",
        body: params
    });
    return res.json();
}

async function deleteRecord(tableName, fieldName, fieldValue) {
    const params = new URLSearchParams();
    params.append("tableName", tableName);
    params.append("fieldName", fieldName);
    params.append("fieldValue", fieldValue);
    
    const res = await fetch(`${API_BASE}/deleteRecord.jsp`, {
        method: "POST",
        body: params
    });
    return res.json();
}

// ----------------- Helper Functions -----------------
function secondsToMMSS(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

// ----------------- Timeline Component -----------------
export default function Timeline({ timelineLength }) {
  // Use dynamic timeline length from prop
  const timelineWidthSeconds = typeof timelineLength === 'number' ? timelineLength : 60 * 60 * 12 * 4;
  const timelineRef = useRef(null);
  const rulerRef = useRef(null);


  const [pixelsPerSecond, setPixelsPerSecond] = useState(1);
  const [markers, setMarkers] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [selectedType, setSelectedType] = useState("ad");
  const [draggingMarker, setDraggingMarker] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [resizeOverlay, setResizeOverlay] = useState(null);
  const [overlayInput, setOverlayInput] = useState({ type: "chapter", start: "", end: "" });
  const [recentlyDragged, setRecentlyDragged] = useState(false);

  const secondsToPx = s => Math.round(s * pixelsPerSecond);
  const pxToSeconds = px => px / pixelsPerSecond;

  // ----------------- Load markers & overlays -----------------
  useEffect(() => {
    (async () => {
      try {
        const markerRows = await fetchTable("markers");
        const overlayRows = await fetchTable("overlays");

        setMarkers(markerRows.map(r => ({
          id: r.id,
          seconds: Number(r.seconds),
          type: r.type
        })));

        setOverlays(overlayRows.map(r => ({
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
  }, []);

  // ----------------- Add Overlay -----------------
  const handleAddOverlay = (e) => {
    e.preventDefault();
    const { type, start, end } = overlayInput;
    const [sm, ss] = start.split(":").map(Number);
    const [em, es] = end.split(":").map(Number);
    const startSec = sm * 60 + (ss || 0);
    const endSec = em * 60 + (es || 0);
    if (type !== "chapter" && type !== "autoplay") return;
    if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) return;

    // Prevent duplicate overlay of same type, start, and end
    const duplicate = overlays.some(ov => ov.type === type && Math.round(ov.startSeconds) === Math.round(startSec) && Math.round(ov.endSeconds) === Math.round(endSec));
    if (duplicate) {
      alert("An overlay of this type and time already exists.");
      return;
    }
    saveRecord("overlays",
      ["startSeconds","endSeconds","type"],
      [startSec, endSec, type]
    ).then(() => {
      // Fetch updated overlays from backend
      fetchTable("overlays").then(overlayRows => {
        setOverlays(overlayRows.map(r => ({
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
    saveRecord("markers", ["seconds","type"], [seconds, selectedType])
      .then(() => {
        // Fetch updated markers from backend
        fetchTable("markers").then(markerRows => {
          setMarkers(markerRows.map(r => ({
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
          saveRecord("markers", ["id","seconds","type"], [moved.id, moved.seconds, moved.type])
            .then(() => {
              fetchTable("markers").then(markerRows => {
                setMarkers(markerRows.map(r => ({
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
          const newOv = { ...ov, startSeconds: newStart, endSeconds: newStart + width };
          saveRecord("overlays",
            ["id","startSeconds","endSeconds","type"],
            [newOv.id,newOv.startSeconds,newOv.endSeconds,newOv.type]
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
          const newOv = { ...ov, startSeconds: newStart, endSeconds: newEnd };
          saveRecord("overlays",
            ["id","startSeconds","endSeconds","type"],
            [newOv.id,newOv.startSeconds,newOv.endSeconds,newOv.type]
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
  const zoomIn = () => setPixelsPerSecond(p => Math.min(p*1.6, 5));
  const zoomOut = () => setPixelsPerSecond(p => Math.max(p/1.6, 0.005));

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
  return (
    <div className="page">
      <form onSubmit={handleAddOverlay} style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <select value={overlayInput.type} onChange={e=>setOverlayInput(o=>({...o,type:e.target.value}))} style={{width:120}}>
          <option value="chapter">Chapter Overlay</option>
          <option value="autoplay">Autoplay Overlay</option>
        </select>
        <input type="text" placeholder="Start (mm:ss)" value={overlayInput.start} onChange={e=>setOverlayInput(o=>({...o,start:e.target.value}))} style={{width:100}}/>
        <input type="text" placeholder="End (mm:ss)" value={overlayInput.end} onChange={e=>setOverlayInput(o=>({...o,end:e.target.value}))} style={{width:100}}/>
        <button type="submit" style={{ padding:"6px 14px", borderRadius:6, border:"none", background:"gold", color:"#333" }}>Add Overlay</button>
      </form>

      <div className="controls-row">
        <div className="marker-buttons">
          {Object.keys(MARKER_TYPES).map(k => (
            <button key={k} className={`type-btn ${selectedType===k?"active":""}`} onClick={()=>setSelectedType(k)} title={MARKER_TYPES[k].label}>
              <span className="icon">{MARKER_TYPES[k].icon}</span>
              <span className="txt">{MARKER_TYPES[k].label}</span>
            </button>
          ))}
        </div>

        <div className="zoom-controls">
          <button onClick={zoomOut}>➖</button>
          <div className="zoom-value">{(pixelsPerSecond*3600).toFixed(0)} px / hr</div>
          <button onClick={zoomIn}>➕</button>
        </div>
      </div>
       <div className="ruler-wrapper" ref={timelineRef}>
        <div
          className="ruler"
          ref={rulerRef}
          style={{ width: secondsToPx(timelineWidthSeconds) }}
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

          {overlays.map((ov, idx) => {
            const color = MARKER_TYPES[ov.type]?.color || "#888";
            const left = secondsToPx(ov.startSeconds);
            const width = secondsToPx(ov.endSeconds - ov.startSeconds);
            return (
              <div
                key={idx}
                className={`overlay ${ov.type}`}
                style={{
                  position: "absolute",
                  left,
                  top: 0,
                  width,
                  height: 32,
                  background: color + (ov.addedByForm ? "66" : "33"),
                  border: `2px solid ${color}`,
                  borderRadius: 6,
                  zIndex: 0,
                  cursor: "move",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "auto",
                  userSelect: "none",
                  outline: ov.addedByForm ? `2px solid ${color}` : undefined,
                }}
                title={`${ov.type}: ${secondsToMMSS(ov.startSeconds)} - ${secondsToMMSS(ov.endSeconds)}`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - left;
                  setDragOverlay({ idx, offset }); // ✅ Corrected here
                }}
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
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setResizeOverlay({ idx, edge: "left" });
                  }}
                />
                <span style={{ margin: "0 auto", fontWeight: 600, color }}>{ov.type}</span>
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
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setResizeOverlay({ idx, edge: "right" });
                  }}
                />
                <div
                  className="overlay-delete"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: 4,
                    cursor: "pointer",
                    color: "#c00",
                    fontWeight: 700,
                    zIndex: 3,
                  }}
                  onClick={() => removeOverlay(idx)}
                  title="Delete overlay"
                >
                  ✖
                </div>
              </div>
            );
          })}

          <div className="markers-layer">
            {markers.map((m) => {
              const left = secondsToPx(m.seconds);
              const def = MARKER_TYPES[m.type] || MARKER_TYPES.ad;
              return (
                <div
                  key={m.id}
                  className="marker"
                  style={{ left, cursor: "move" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    const offset = e.clientX - rulerRef.current.getBoundingClientRect().left - left;
                    setDraggingMarker({ id: m.id, offset });
                  }}
                >
                  <div className="marker-pin" style={{ background: def.color }}>
                    <span className="marker-icon">{def.icon}</span>
                  </div>
                  <div className="marker-time">{secondsToMMSS(m.seconds)}</div>
                  <div
                    className="marker-delete"
                    style={{ position: "absolute", right: -10, top: -10, cursor: "pointer", color: "#c00", fontWeight: 700, zIndex: 3 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMarker(m.id);
                    }}
                    title="Delete marker"
                  >
                    ✖
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hint">
        Click to add marker or overlay. Drag to move. Resize overlays by dragging the edges. Use the form above to add overlays for chapter/autoplay.
      </div>
    </div>
  );
}