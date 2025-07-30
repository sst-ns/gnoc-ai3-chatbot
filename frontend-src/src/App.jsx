import { AppLayout, Loader } from "./core-components/index";
import { Suspense } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

function App() {
  return (
    <Router>
      <Suspense fallback={<Loader open={true} />}>
        <Routes>
          <Route path="*" element={<AppLayout />}></Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
