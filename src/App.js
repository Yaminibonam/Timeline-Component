import TimelineComponent from "./Timeline";

function App() {
  // Static timeline data
  const timelineLength = 1200;
  
  const markers = [
    { id: 1, seconds: 120, type: "ad" },
    { id: 2, seconds: 300, type: "skip" },
    { id: 3, seconds: 600, type: "ad" }
  ];
  const overlays = [
    { id: 1, type: "chapter", startSeconds: 0, endSeconds: 180, addedByForm: false },
    { id: 2, type: "chapter", startSeconds: 181, endSeconds: 600, addedByForm: false },
    { id: 3, type: "autoplay", startSeconds: 601, endSeconds: 900, addedByForm: false }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <h1>My Timeline App</h1>
      <TimelineComponent
        timelineLength={timelineLength}
        markers={markers}
        overlays={overlays}
      />
    </div>
  );
}

export default App;

