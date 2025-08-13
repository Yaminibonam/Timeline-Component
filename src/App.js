import React, { useState, useEffect } from "react";
import TimelineComponent from "./Timeline";
import { fetchTable } from "./api";

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideoID, setSelectedVideoID] = useState("");
  const [timelineLength, setTimelineLength] = useState(0);

  useEffect(() => {
    fetchTable("video").then(rows => {
      setVideos(rows);
      if (rows.length > 0) {
        setSelectedVideoID(rows[0].videoID);
        setTimelineLength(Number(rows[0].timeInSeconds));
      }
    });
  }, []);

  useEffect(() => {
    const video = videos.find(v => v.videoID === selectedVideoID);
    if (video) {
      setTimelineLength(Number(video.timeInSeconds));
    }
  }, [selectedVideoID, videos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <h1>My Timeline App</h1>
      <div style={{ marginBottom: 16 }}>
        <label>
          Select Video:
          <select
            value={selectedVideoID}
            onChange={e => setSelectedVideoID(e.target.value)}
            style={{ marginLeft: 8, width: 220 }}
          >
            {videos.map(v => (
              <option key={v.videoID} value={v.videoID}>
                {v.URL} ({v.timeInSeconds}s)
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ flex: 1 }} />
      {selectedVideoID && timelineLength > 0 && (
        <TimelineComponent timelineLength={timelineLength} videoID={selectedVideoID} />
      )}
    </div>
  );
}

export default App;

