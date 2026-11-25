// Маршруты по экранам MVP (п.6.2 ТЗ). Guard: Layout требует входа, RequireRole — роль (AUTH-03).
import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import AdminPanel from "./pages/AdminPanel";
import Dashboard from "./pages/Dashboard";
import Lesson from "./pages/Lesson";
import Login from "./pages/Login";
import Task from "./pages/Task";
import TeacherPanel from "./pages/TeacherPanel";
import Test from "./pages/Test";

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth(); // Layout выше уже гарантирует вход
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "lessons/:lessonId", element: <Lesson /> },
      { path: "tasks/:taskId", element: <Task /> },
      { path: "tests/:testId", element: <Test /> },
      {
        path: "teacher",
        element: (
          <RequireRole roles={["TEACHER", "ADMIN"]}>
            <TeacherPanel />
          </RequireRole>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <AdminPanel />
          </RequireRole>
        ),
      },
    ],
  },
]);
