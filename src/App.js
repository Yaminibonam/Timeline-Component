import React, { useState } from "react";
import TimelineComponent from "./Timeline";

function App() {
  // Timeline length in seconds (default: 4 x 12 hours)
  const [timelineLength, setTimelineLength] = useState(60 * 60 * 12 * 4);

  // Example: UI to change timeline length (for future video integration)
  // You can remove this input later and set timelineLength from video duration
  return (
    <div>
      <h1>My Timeline App</h1>
      <div style={{ marginBottom: 16 }}>
        <label>
          Timeline Length (seconds):
          <input
            type="number"
            value={timelineLength}
            min={60}
            step={60}
            onChange={e => setTimelineLength(Number(e.target.value))}
            style={{ marginLeft: 8, width: 120 }}
          />
        </label>
      </div>
      <TimelineComponent timelineLength={timelineLength} />
    </div>
  );
}

export default App;

