// Controls component for Timeline
import React from "react";

export default function Controls({ overlayInput, setOverlayInput, handleAddOverlay, selectedType, setSelectedType, zoomIn, zoomOut, pixelsPerSecond }) {
    return (
        <>
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
                    <button className={`type-btn ${selectedType==="ad"?"active":""}`} onClick={()=>setSelectedType("ad")} title="Ad">
                        <span className="icon">📢</span>
                        <span className="txt">Ad</span>
                    </button>
                    <button className={`type-btn ${selectedType==="skip"?"active":""}`} onClick={()=>setSelectedType("skip")} title="Skip">
                        <span className="icon">⏭️</span>
                        <span className="txt">Skip</span>
                    </button>
                </div>
                <div className="zoom-controls">
                    <button onClick={zoomOut}>➖</button>
                    <div className="zoom-value">{(pixelsPerSecond*3600).toFixed(0)} px / hr</div>
                    <button onClick={zoomIn}>➕</button>
                </div>
            </div>
        </>
    );
}
