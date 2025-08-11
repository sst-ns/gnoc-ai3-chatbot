import AppRouting from "../../AppRouting";
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, useState } from "react";
import { Loader } from "../index";

const AppContent = (props) => {
  const { userName } = props;
  const [routes, setRoute] = useState(AppRouting);

  return (
    <div
      className="app-content"
      style={{ width: props?.menuOpened ? "calc(100% - 15.3rem)" : "100%" }}
    >
      <Suspense fallback={<Loader open={true} />}>
        <Routes>
          {routes.map((e, i) => {
            return (
              e.authenticated && (
                <Route
                  exact={e.exact}
                  key={i}
                  path={e.path}
                  id={e.name}
                  element={
                    e.path === "/" ? (
                      userName && <Navigate to="/dashboard" replace />
                    ) : (
                      <e.element />
                    )
                  }
                ></Route>
              )
            );
          })}
        </Routes>
      </Suspense>
    </div>
  );
};

export default AppContent;
