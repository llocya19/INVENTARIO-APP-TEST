import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import { getUser } from "./services/authService";

/* Pages */
import Login from "./pages/Login";
import Users from "./pages/Users";
import Areas from "./pages/Areas";
import AreaView from "./pages/AreaView";
import ItemDetailPage from "./pages/ItemDetail";
import EquipoNuevo from "./pages/EquipoNuevo";
import EquipoDetalle from "./pages/EquipoDetalle";
import EquipoNuevoUso from "./pages/EquipoNuevoEnUso";
import Auditorias from "./pages/Auditorias";
import IncidenciasAdmin from "./pages/IncidenciasAdmin";
import MisIncidencias from "./pages/MisIncidencias";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard"; // ✅ NUEVO

/* Layout */
import AppLayout from "./components/layout/AppLayout";

function HomeSwitch() {
  const u = getUser();
  if (u?.rol === "USUARIO") return <MisIncidencias />;
  if (u?.rol === "ADMIN") return <Dashboard />; // ✅ Dashboard para Admin
  return <Areas />;
}

export default function App() {
  return (
    <AppLayout>
      <Routes>
        {/* Login sin protección */}
        <Route path="/login" element={<Login />} />

        {/* HOME */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeSwitch />
            </ProtectedRoute>
          }
        />

        {/* Dashboard directo */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Resto de rutas (igual que antes) */}
        <Route
          path="/areas"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <Areas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <AreaView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/items/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <ItemDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipos/:id"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoDetalle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:areaId/equipos/nuevo"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoNuevo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/areas/:areaId/equipos/nuevo-uso"
          element={
            <ProtectedRoute roles={["ADMIN", "PRACTICANTE"]}>
              <EquipoNuevoUso />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auditorias"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Auditorias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidencias"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <IncidenciasAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-incidencias"
          element={
            <ProtectedRoute roles={["USUARIO", "PRACTICANTE", "ADMIN"]}>
              <MisIncidencias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <div className="mx-auto w-full max-w-7xl px-4 py-6">
              Página no encontrada
            </div>
          }
        />
      </Routes>
    </AppLayout>
  );
}
